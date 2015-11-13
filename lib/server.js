Presence = {};
var connections = {};

var presenceCheckExpirationInterval = (Meteor.settings && Meteor.settings.public && Meteor.settings.public.presences && Meteor.settings.public.presences.presenceCheckExpirationInterval) || 5000;
var presenceExpireAfter = (Meteor.settings && Meteor.settings.public && Meteor.settings.public.presences && Meteor.settings.public.presences.presenceExpireAfter) || 10000;

var serverPresenceUpdateInterval = (Meteor.settings && Meteor.settings.public && Meteor.settings.public.presences && Meteor.settings.public.presences.serverPresenceUpdateInterval) || 30000;
var serverPresenceCleanupInterval = (Meteor.settings && Meteor.settings.public && Meteor.settings.public.presences && Meteor.settings.public.presences.serverPresenceCleanupInterval) || 60000;
var serverPresenceExpireAfter = (Meteor.settings && Meteor.settings.public && Meteor.settings.public.presences && Meteor.settings.public.presences.serverPresenceExpireAfter) || 300000;

var os = Npm.require('os');
var hostName = (os && _.isFunction(os.hostname) && os.hostname()) || "Unknown";
var serverId = Random.id();

//console.log('Presences initialized, host: ' + hostName + " serverId: " + serverId);

var expire = function(id) {
	Presences.remove(id);
	delete connections[id];
};

var expireServer = function(id) {
	Presences.remove({serverId: id});
	ServerPresences.remove({_id: id});
};

var cleanupExpiredServers = function(){
	var activeServers = [];
	ServerPresences.find({}).forEach(function(serverPresence) {
		if (serverPresence.lastSeen < (Date.now() - serverPresenceExpireAfter)){
			expireServer(serverPresence._id);
		}else{
			activeServers.push(serverPresence._id);
		}
	});
	//Cleanup any orphaned presences that belong to servers that are no longer in the ServerPresences collection.
	if(Presences.find({serverId: {$nin: activeServers}}).count() > 0){
		Presences.remove({serverId: {$nin: activeServers}});
	}
};

var tick = function(id) {
	if(_.isObject(connections[id])){
		connections[id].lastSeen = Date.now();
	}else{
		connections[id] = {
			lastSeen: Date.now()
		}
	}
};

//This allows the app to inject its own fields into the presence document, for example a system that the user belongs to
Presence.UsersPresenceDocument = function(currentDocument) {
	//By default we just return the document
	return currentDocument;

	//But if you wanted you could over-write this function with something like
	//if(currentDocument.userId){
	//	var user = Users.findOne(currentDocument.userId, {fields: {systemId: 1}});
	//	if(user && user.systemId){
	//		_.extend(currentDocument, {systemId: user.systemId});
	//	}
	//}
	//return currentDocument;
};

Meteor.startup(function() {
	//console.log('Presences Startup!');
	cleanupExpiredServers();
	ServerPresences.upsert(serverId, { $set: {
		host: hostName,
		lastSeen: Date.now()
	}});

});

Meteor.onConnection(function(connection) {
	//console.log('connectionId: ' + connection.id + ' userId: ' + this.userId);
	var presenceDoc = {
		serverId: serverId,
		host: hostName,
		clientAddress: connection.clientAddress
	};
	presenceDoc = Presence.UsersPresenceDocument(presenceDoc);
	Presences.upsert(connection.id, { $set: presenceDoc });
	connections[connection.id] = {};
	tick(connection.id);

	connection.onClose(function() {
		// console.log('connection closed: ' + connection.id);
		expire(connection.id);
	});
});

Meteor.methods({
	updatePresence: function(state) {
		check(state, Match.Any);
		this.unblock();
		if (this.connection && this.connection.id) {
			//console.log('updatePresence: ' + this.connection.id);
			var presenceDoc = {
				serverId: serverId,
				host: hostName,
				clientAddress: this.connection.clientAddress,
				state: state
			};
			if (this.userId)
				presenceDoc.userId = this.userId;

			presenceDoc = Presence.UsersPresenceDocument(presenceDoc);
			Presences.upsert(this.connection.id, { $set: presenceDoc });
		}
	},
	presenceTick: function() {
		check(arguments, [Match.Any]);
		this.unblock();
		if (this.connection && connections[this.connection.id]){
			tick(this.connection.id);
		}else{
			return true; //Returns true to let client know we don't have a state for them, and cause the client to re-call 'updatePresence'
		}
	}
});

Meteor.setInterval(function() {
	ServerPresences.upsert(serverId, { $set: {
		host: hostName,
		lastSeen: Date.now()
	}});
}, serverPresenceUpdateInterval);

Meteor.setInterval(function() {
	_.each(connections, function(connection, id) {
		if (connection.lastSeen < (Date.now() - presenceExpireAfter))
			expire(id);
	});
}, presenceCheckExpirationInterval);


Meteor.setInterval(cleanupExpiredServers, serverPresenceCleanupInterval);

try {
	//If this server is shutdown properly, cleanup after ourselves
	process.on('exit', expireServer(serverId));
} catch (e) {

}
