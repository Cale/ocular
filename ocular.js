if (Meteor.isClient) {

  Meteor.startup( function () {    
    var favCount;

    sizeArticle = function() {
      $( "#article" ).width( $( window ).width() - 200 );
    }
    sizeArticle();

    $(window).resize( function() {
      sizeArticle();
    });

    // Make iframe scrollable on iOS webkit
    if ( !/iPhone|iPod|iPad/.test( navigator.userAgent ) ) {
      $( "#article" ).css({
        overflow: 'hidden'
      });
    }

    // Feed refresh timer
    timer = function( time, func ) {
      refreshFeedsTimer = window.setTimeout( function() {
        func();
      }, time )
    }
    timer( 600000, refreshFeeds );

    if (Meteor.user()) {
      $( ".feed-input, .feed-list" ).show();
      refreshFeeds();
    }
    Deps.autorun( function() {
      if ( Meteor.userId() ) {
        $( ".feed-input, .feed-list" ).show();
      }
    });

    loadingIndicator = function() {
      $( ".loading-articles" ).fadeIn();
    }

  });

  Meteor.subscribe( "feeds" );
  Meteor.subscribe( "articles" );
  

  Template.feedList.feeds = function() {
    feeds = Feeds.find({$or: [{owner: Meteor.userId()}]}, {sort: {"title": 1}});
    return feeds;
  }

  Template.articleList.articles = function() {
    articles = Session.get('arts')
    return articles;
  }

  Template.articleList.rendered = function() {
    feedId = Session.get( 'articleList' );
    readingArticleId = Session.get( 'reading' );
    $( ".article-list."+feedId ).show();
    $( ".loading-articles" ).hide();
    $( "#"+readingArticleId+" .triangle" ).show();
    if ( Session.get('arts').length == 0 ) {
      $( ".no-articles" ).show();
    }
  }

  Template.favoritesList.favorites = function() {
    favorites = Articles.find({$and: [{owner: Meteor.userId()}, {favorite: true}]}, {sort: {"publishedDate": -1}});
    return favorites;
  }

  Template.articleList.events({
    'click .article': function( event ) {
      // Display in iframe & mark as read
      event.preventDefault();
      var that = this;
      $( ".triangle" ).hide();
      $( "#"+this._id+" .triangle" ).show();
      $( "#article iframe" ).attr( 'src', this.url );
      Session.set( 'reading', this._id );

      if ( !this.read ) {
        Meteor.call( 'markRead', this._id, function( error, result ) {
          Session.set( 'arts', Articles.find({$and: [{ feedId: this.feedId }, {favorite: false}]}, {sort: {"publishedDate": -1}}).fetch());
          Meteor.call( 'updateReadCount', that.feedId, -1 );
        });
      }
    },
    'click .favorite': function( event ) {
      event.preventDefault();
      event.stopPropagation();
      Meteor.call( 'markFavorite', this._id, true, function() {
        Session.set( 'arts', Articles.find({$and: [{ feedId: this.feedId }, {favorite: false}]}, {sort: {"publishedDate": -1}}).fetch());
      });
    },
    'click .delete-article': function( event ) {
      event.preventDefault();
      event.stopPropagation();
      that = this;
      if ( this.read === false ) {
        Meteor.call( 'updateReadCount', that.feedId, -1 );
      }
      Meteor.call( 'deleteArticle', this._id, function() {
        Session.set( 'arts', Articles.find({$and: [{ feedId: this.feedId }, {favorite: false}]}, {sort: {"publishedDate": -1}}).fetch());
      });
    }
  });

  Template.feedList.events({
    'click .add-feed': function ( event, template ) {
      Session.set( "action", true );
      event.preventDefault();
      var url = template.find( ".url" ).value;

      $( ".article-list" ).hide();
      Session.set( 'reading', null );

      if (url.length) {

        $.ajax({
          type: "GET",
          url: "http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=10&q="+url,
          dataType: "jsonp",
          success: function( data ) {
            if ( data['responseStatus'] !== 200 ) {
              alert( "Could not fetch feed from "+url+". Try again." );
            } else {
              var feed = data['responseData'];
              var title = data['responseData']['feed']['title'];
              var feedId;
              var articleCount = data['responseData']['feed']['entries'].length;
              //console.log("Article count: "+articleCount);
              //console.log(title);
              Meteor.call( 'addFeed', {
                url: url,
                title: title,
                articleCount: articleCount
              }, function( error, result ) {
                feedId = result;
                // Store initial articles
                for ( var i = 0; i < feed['feed']['entries'].length; i++) {
                  //console.log(feed['feed']['entries'][i]['title']+", "+feed['feed']['entries'][i]['link']+", "+feed['feed']['entries'][i]['publishedDate']);
                  if ( i === 0 ) {
                    Meteor.call( 'setLastPublishedDate', feedId, Date.parse( feed['feed']['entries'][i]['publishedDate'] ) );
                    //console.log( "Store latest published date: "+feed['feed']['entries'][i]['publishedDate'] );
                  }
                  Meteor.call( 'addArticle', {
                      feedId: feedId,
                      title: feed['feed']['entries'][i]['title'],
                      url: feed['feed']['entries'][i]['link'],
                      publishedDate: feed['feed']['entries'][i]['publishedDate']
                    }, function( error, result ) {
                    //console.log("Result: "+result);
                  });
                }
              });
              // Clear add feed form
              $( ".url" ).val('');
            }
            //Session.set('title', result);
            //console.log(result.data['responseData']['feed']['title']);
          }
        });
      } else {
        alert( "Add a url!" );
      }
    },
    'click .refresh-feeds': function( event) {
      event.preventDefault();
      refreshFeeds( event );
    },
    'click .delete-feed': function( event ) {
      event.stopPropagation();
      event.preventDefault();
      Meteor.call( 'deleteAllArticles', this._id );
      Meteor.call( 'deleteFeed', this._id );
    },
    'click .mark-all-read': function( event ) {
      event.stopPropagation();
      event.preventDefault();
      loadingIndicator();
      Meteor.call( 'updateReadCount', this._id, -(this.unreadCount) );
      Meteor.call( 'markAllRead', this._id, function() {
        Session.set( 'arts', Articles.find({$and: [{ feedId: this.feedId }, {favorite: false}]}, {sort: {"publishedDate": -1}}).fetch());
      });
    },
    'click .delete-all-read': function( event ) {
      event.stopPropagation();
      event.preventDefault();
      loadingIndicator();
      Meteor.call( 'deleteAllRead', this._id, function() {
        Session.set( 'arts', Articles.find({$and: [{ feedId: this.feedId }, {favorite: false}]}, {sort: {"publishedDate": -1}}).fetch());
      });
    },
    'click .feed-title': function( event ) {
      event.preventDefault();
      $( ".loading-articles" ).show();
      $( ".favorites-list" ).hide();
      $( ".no-articles" ).hide();
      if ( Session.get( 'articleList' ) === this._id ) {
        if ( $( ".article-list."+this._id ).is( ':visible' ) ) {
          $( ".article-list" ).hide();
        } else {
          $( ".loading-articles" ).hide();
          $( ".article-list."+this._id ).show();
          if ( Session.get('arts').length == 0 ) {
            $( ".no-articles" ).show();
          }
        }
      } else {
        $( ".article-list" ).hide();
        Session.set( 'articleList', this._id );
        Session.set( 'arts', Articles.find({$and: [{ feedId: this._id }, {favorite: false}]}, {sort: {"publishedDate": -1}}).fetch());
      }
    }
  });

  Template.feedList.events({
    'click .favorites': function( event ) {
      event.preventDefault();
      event.stopPropagation();
      favCount = Articles.find({$and: [{owner: Meteor.userId()}, {favorite: true}]}, {sort: {"publishedDate": -1}});
      favCount = favCount.fetch().length;
      if ( $( ".favorites-list" ).is( ':visible') ) {
        $( ".favorites-list" ).hide();
      } else {
        $( ".article-list" ).hide();
        $( ".favorites-list" ).show();
      }
      if ( favCount === 0 ) {
        $( ".no-favorites" ).show();
      } else {
        $( ".no-favorites" ).hide();
      }
    },
    'click .article.favorite-article': function( event ) {
      event.preventDefault();
      event.stopPropagation();
      $( "#article iframe" ).attr( 'src', this.url );
    },
    'click .delete-favorite': function( event ) {
      event.preventDefault();
      event.stopPropagation();
      Meteor.call( 'deleteArticle', this._id );
    }
  });

  refreshFeeds = function() {
    if ( refreshFeedsTimer != null ) {
      clearTimeout( refreshFeedsTimer );
    }
    timer( 600000, refreshFeeds );
    time = new Date();
    console.log("");
    console.log("Refreshing feeds at "+time.toLocaleTimeString());
    Session.set( "action", true );
    var feeds = Feeds.find({$or: [{owner: Meteor.userId()}]}, {sort: {"title": 1}}).fetch();
    var feedCount = feeds.length;
    var i = 0;

    updateSingleFeed = function( feeds, i ) {
      var url = feeds[i]['url'];
      var feedId = feeds[i]['_id'];
      var feedTitle = feeds[i]['title'];
      var lastPublished = feeds[i]['lastPublishedDate'];
      var newLastPublished;

      $.ajax({
        type: "GET",
        url: "http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=10&q="+url,
        dataType: "jsonp",
        success: function( data ) {
          if ( data['responseStatus'] !== 200 ) {
            console.log( "Could not fetch "+url );
          } else {
            var articles = data['responseData']['feed']['entries'];
            var articleCount = articles.length;

            for ( var j = 0; j < articles.length; j++ ) {
              //console.log( "Article publish date: "+articles[j]['publishedDate']+" "+articles[j]['title'] );
              //console.log( "Saved articles' last publish date: "+lastPublished );

              // If first article, save published date.
              if ( j === 0 ) {
                newLastPublished = Date.parse( articles[j]['publishedDate'] );
                //console.log( "" );
                //console.log( "Newest article: "+newLastPublished )
              }

              // If article publish date is newer than feed's last published date, add the article to the DB.
              //console.log( feedTitle+" last published "+lastPublished+" || Article: "+articles[j]['publishedDate']);
              if ( Date.parse( articles[j]['publishedDate'] ) > lastPublished ) {
                //console.log( "===== Adding this new article to "+feedTitle+" ^^^^^^^" );
                Meteor.call( 'addArticle', {
                  feedId: feedId,
                  title: articles[j]['title'],
                  url: articles[j]['link'],
                  publishedDate: articles[j]['publishedDate']
                }, function( error, result ) {
                  //console.log( "Added article to "+feedTitle );
                  Meteor.call( 'updateReadCount', feedId, 1);
                });
              }
              //console.log("j = "+j);
              //console.log(articleCount);
              // If last article, save last published date from newest article.
              if ( j === ( articleCount - 1 ) ) {
                //console.log("Last article");
                //console.log( "Last article? i = "+i+" Length = "+articles.length );
                //console.log(articles[i]['publishedDate']);
                if ( feedId === Session.get( 'articleList' ) ) {
                  //console.log( "Rebuilding article list for "+feedId)
                  Session.set( 'arts', Articles.find({$and: [{ feedId: feedId }, {favorite: false}]}, {sort: {"publishedDate": -1}}).fetch());
                }
                Meteor.call( 'setLastPublishedDate', feedId, newLastPublished, function( error, result ) {
                  // Start the next feed.
                  i = i+1;
                  if ( i < feedCount ) {
                    updateSingleFeed( feeds, i );
                  }
                });
              }
            }
          }
        }
      });
    }
    updateSingleFeed( feeds, i );
  }

}

if (Meteor.isServer) {
  Meteor.startup( function () {
    // code to run on server at startup.
  });

  Meteor.publish("feeds", function () {
    return Feeds.find({$or: [{owner: this.userId}]}, {sort: {"title": 1}});
  });
  Meteor.publish("articles", function () {
    return Articles.find({$or: [{owner: this.userId}]}, {sort: {"publishedDate": -1}});
  });
}
