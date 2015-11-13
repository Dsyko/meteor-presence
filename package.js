Package.describe({
	summary: "A package to help track users' presence"
});

Package.onUse(function (api) {
	api.versionsFrom('1.0.2.1');
	api.use('underscore', 'random');
	api.addFiles('lib/common.js', ['client', 'server']);
	api.addFiles('lib/client.js', 'client');
	api.addFiles('lib/server.js', 'server');

	if (typeof api.export !== 'undefined') {
		api.export('Presences', ['client', 'server']);
		api.export('ServerPresences', ['server']);
		api.export('Presence', ['client', 'server']);
	}
});
