var botId          = "st-007da037-67f9-55c3-bf93-6272ca639359";
var botName        = "Book a Cab";
var sdk            = require("./lib/sdk");
var Promise        = sdk.Promise;
var request        = require("request");
var config         = require("./config");
var mockServiceUrl = config.examples.mockServicesHost + '/cabbot';

function findCabs(/*userLoc*/) {
    return new Promise(function(resolve, reject) {
        request({
            url: mockServiceUrl + '/findcabs',
            method: 'get',
        }, function(err, res) {
            if (err) {
                return reject(err);
            }
            resolve(res.body);
        });
    });
}

function cabBookingService(requestId, cabId, userLoc, destination, callbacks) {
    return new Promise(function(resolve, reject) {
        request({
            url: mockServiceUrl + '/findcabs',
            method: 'post',
            headers: {
                'content-type' : 'application/json'
            },
            body: {
                requestId   : requestId,
                cabId       : cabId,
                loc         : userLoc,
                destination : destination
            },
            json: true
        }, function(err, res) {
            if (err || !res.body) {
                return reject(err);
            }
            if (res.body.success) {
                callbacks.on_success(requestId);
                return;
            } else {
                callbacks.on_failure(requestId);
            }
            resolve(res);
        });
    });
}

function onBookingSuccess(requestId) {
    sdk.getSavedData(requestId)
        .then(function(data) {
            data.context.bookedCab = data.entities.selectedCab;
            data.context.successful = true;

            sdk.respondToHook(data);
        });
}

function onBookingFailure(requestId) {
    sdk.getSavedData(requestId)
        .then(function(data) {
            data.context.successful = false;

            sdk.respondToHook(data);
        });
}

function bookTheCab(requestId, cabId, userLoc, destination) {
    cabBookingService(requestId, cabId, userLoc, destination, {
        on_success : onBookingSuccess,
        on_failure : onBookingFailure
    });
}

module.exports = {
    botId   : botId,
    botName : botName,

    on_user_message : function(requestId, data, callback) {
        sdk.sendBotMessage(data, callback);
    },
    on_bot_message  : function(requestId, data, callback) {
        sdk.sendUserMessage(data, callback);
    },
    on_webhook      : function(requestId, data, componentName, callback) {
        var context = data.context;

        if (componentName === 'FindNearbyCabs') {
            findCabs()
                .then(function(cabList) {
                    context.cabList = cabList;
                    callback(null, data);
                });
        } else if (componentName === 'BookTheCab') {
            sdk.saveData(requestId, data)
                .then(function() {
                    bookTheCab(requestId, context.entities.selectedCab.id, context.session.UserSession.location, context.entities.whereTo);
                    callback(null, new sdk.AsyncResponse());
                });
        }
    }
};
