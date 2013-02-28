Feeds = new Meteor.Collection( "feeds" );

Feeds.allow({
  insert: function (userId, feed, title) {
    return false; // no cowboy inserts -- use addFeed method
  },
  update: function (userId, feeds, fields, modifier) {
    return _.all(feeds, function (feed) {
      if (userId !== feed.owner)
        return false; // not the owner

      var allowed = ["unreadCount"];
      if (_.difference(fields, allowed).length)
        return false; // tried to write to forbidden field

      // A good improvement would be to validate the type of the new
      // value of the field (and if a string, the length.) In the
      // future Meteor will have a schema system to makes that easier.
      return true;
    });
  },
  remove: function (userId, feeds) {
    return ! _.any(feeds, function ( feed ) {
      // deny if not the owner
      return feed.owner !== userId;
    });
  }
});

Articles = new Meteor.Collection( "articles" );

Articles.allow({
  insert: function( userId, feedId, title, url, publishedDate ) {
    return false;
  },
  update: function ( userId, articles, fields, modifier ) {
    return _.all(articless, function (article) {
      if (userId !== article.owner)
        return false; // not the owner
      var allowed = ["read", "favorite", "share"];
      if (_.difference(fields, allowed).length)
        return false;
      return true;
    });
  },
  remove: function( userId, articles ) {
    return ! _.any( articles, function ( article ) {
      // deny if not the owner && not feed
      return article.owner !== userId;
    });
  }
});

Meteor.methods({
  addFeed: function ( options ) {
    options = options || {};
    return Feeds.insert({
      owner: this.userId,
      url: options.url,
      title: options.title,
      lastPublishedDate: 0,
      group: 0,
      unreadCount: options.articleCount
    });
   },
  // getFeed: function( feedUrl ) {
  //   this.unblock();
  //   console.log("URL: "+feedUrl);
  //   var result = Meteor.http.call( "GET", "http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=10&q="+feedUrl );
  //   return result;
  // },
  addArticle: function( options ) {
    options = options || {};
    pubDate = Date.parse( options.publishedDate );
    return Articles.insert({
        owner: Meteor.userId(),
        feedId: options.feedId,
        title: options.title,
        url: options.url,
        publishedDate: pubDate,
        read: false,
        favorite: false,
        share: false
    });
  },
  setLastPublishedDate: function( feedId, lastPublishedDate ) {
    return Feeds.update( feedId, { 
      $set: { lastPublishedDate: lastPublishedDate }  
    });
  },
  markRead: function( articleId ) {
    return Articles.update( articleId, { 
      $set: { read: true } 
    });
  },
  markAllRead: function( feed ) {
    return Articles.update({ feedId: feed }, { $set: { read: true } }, { multi: true });
  },
  deleteAllRead: function( feed ) {
    return Articles.remove({$and: [{feedId: feed}, {read: true}]});
  },
  markFavorite: function( articleId ) {
    return Articles.update( articleId, { 
      $set: { favorite: true } 
    });
  },
  updateReadCount: function( feedId, num ) {
    return Feeds.update( feedId, { 
      $inc: { unreadCount: num } 
    });
  }
});
