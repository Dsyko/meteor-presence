Presences = new Meteor.Collection('presences');
ServerPresences = new Meteor.Collection('serverPresences'); //TODO allow these to be set by config variables...
// For backwards compatibilty
Meteor.presences = Presences;
