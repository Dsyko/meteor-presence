Presence = {};
Presence.state = function() {
	return 'online';
};

// For backwards compatibilty
Meteor.Presence = Presence;

Meteor.startup(function() {
	var presenceTickInterval = (Meteor.settings && Meteor.settings.public && Meteor.settings.public.presences && Meteor.settings.public.presences.presenceTickInterval) || 5000;
	Tracker.autorun(function() {
		if (Meteor.status().status === 'connected')
			Meteor.call('updatePresence', Presence.state());
	});
	Meteor.setInterval(function() {
		if (Meteor.status().status === 'connected'){//If we aren't connected, then let's not fill the method call queue with ticks...
			Meteor.call('presenceTick', function(err, serverNeedsState){
				if(!err && serverNeedsState === true){
					Meteor.call('updatePresence', Presence.state());
				}
			});
		}
	}, presenceTickInterval);
});
