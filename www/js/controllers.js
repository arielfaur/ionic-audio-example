angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope) {})

.controller('ChatsCtrl', function($scope, Chats) {
  $scope.chats = Chats.all();
  $scope.remove = function(chat) {
    Chats.remove(chat);
  }
})

.controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
  $scope.chat = Chats.get($stateParams.chatId);
})

.controller('MusicCtrl', ['$scope', 'MediaManager', function($scope, MediaManager) {
    var urlprefix = '/android_asset/www/audio/';

    $scope.tracks = [
        {
            url: 'https://ionic-audio.s3.amazonaws.com/Message%20in%20a%20bottle.mp3',
            artist: 'The Police',
            title: 'Message in a bottle',
            art: 'https://ionic-audio.s3.amazonaws.com/The_Police_Greatest_Hits.jpg'
        },
        {
            url: urlprefix + '03 - Land Of Confusion.mp3',
            artist: 'Genesis',
            title: 'Land of Confusion'
        },
        {
            url: urlprefix + '02 - Tonight. Tonight. Tonight.mp3',
            artist: 'Genesis',
            title: 'Tonight. Tonight. Tonight'
        }
    ];

    $scope.track = {};

    $scope.stopPlayback = function() {
        MediaManager.stop();
    };

}]);
