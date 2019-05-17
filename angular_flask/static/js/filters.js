'use strict';

/* Filters */

shared.filter('msToTimeFormat', function() {
  return function(millseconds) {
    var seconds = Math.floor(millseconds / 1000);
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor((seconds % 86400) / 3600);
    var minutes = Math.floor(((seconds % 86400) % 3600) / 60);
    var rsec = Math.floor((seconds % 60));
    var timeString = '';
    if(days > 0) timeString += days + "d ";
    if(hours > 0) timeString += hours + " h ";
    if(minutes > 0) timeString += minutes + "m ";
    if(rsec >= 0) timeString += rsec + "s ";

    return timeString;
}
});

shared.filter('secToTimeFormat', function() {
  return function(second) {
    var seconds = Math.floor(second);
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor((seconds % 86400) / 3600);
    var minutes = Math.floor(((seconds % 86400) % 3600) / 60);
    var rsec = Math.floor((seconds % 60));
    var timeString = '';
    if(days > 0) timeString += days + "d ";
    if(hours > 0) timeString += hours + " h ";
    if(minutes > 0) timeString += minutes + "m ";
    if(rsec >= 0) timeString += rsec + "s ";

    return timeString;
}
});
