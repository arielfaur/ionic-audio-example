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

.controller('MusicCtrl', ['$scope',  '$cordovaNativeAudio', function($scope, $cordovaNativeAudio) {
    var audio, urlprefix = '/android_asset/www/audio/';

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

    document.addEventListener("deviceready", function() {
        window.plugins.NativeAudio.preloadComplex( 'music','audio/03 - Land Of Confusion.mp3', 1, 1, 0, function(msg){
        }, function(msg){
            console.log( 'error: ' + msg );
        });

    }, false);

    $scope.playSomething = function() {
        window.plugins.NativeAudio.play('music');
    };

    $scope.stopSomething = function() {
        window.plugins.NativeAudio.stop('music');
    };

    $scope.startStream  = function() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        var context = new AudioContext();

        audio = new Audio();
        var source = context.createMediaElementSource(audio);
        source.connect(context.destination);
        audio.src = 'https://ionic-audio.s3.amazonaws.com/Message%20in%20a%20bottle.mp3'; // 'http://audio-online.net:2300/live';
        audio.play();
    };
    $scope.stopStream = function() {
        audio.stop();
    };
}]);
