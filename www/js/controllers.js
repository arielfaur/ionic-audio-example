angular.module('starter.controllers', [])
  .filter('time', function() {
      return function(input) {
          input = input || 0;

          var t = parseInt(input,10);

          var addLeadingZero = function(n) {
              return (n < 10) ? '0' + n : n;
          };
          return addLeadingZero(Math.floor(t / 60)) + ':' + addLeadingZero(t % 60);
      };
  })
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

.controller('MusicCtrl', ['$scope',  function($scope) {
    var source, context, audio, urlprefix = ionic.Platform.platform() == 'win32' ?  'audio/' : '/android_asset/www/audio/';

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

    $scope.livestream = {
        url: 'http://audio-online.net:2300/live',
        title: 'Live Radio Stream'
    };

      function updateProgress (oEvent) {
          if (oEvent.lengthComputable) {
              var percentComplete = oEvent.loaded / oEvent.total;
              $scope.$apply(function() {
                  $scope.tracks[2].loading = percentComplete;
              });
          } else {
              // Unable to compute progress information since the total size is unknown
          }
      }
      function transferComplete(evt) {
          console.log("The transfer is complete.");
      }

      function getData() {

          var request = new XMLHttpRequest();
          request.addEventListener("progress", updateProgress, false);
          request.addEventListener("load", transferComplete, false);
          request.open('GET', $scope.tracks[2].url, true);

          request.responseType = 'arraybuffer';

          request.onload = function() {
              var audioData = request.response;

              context.decodeAudioData(audioData, function(buffer) {
                    source.buffer = buffer;
                });

          };

          request.send();
      }
    $scope.playSomething = function() {
        context = new AudioContext();
        source =  context.createBufferSource();
        source.connect(context.destination);
        getData();
        source.start(0);
    };

    $scope.stopSomething = function() {
        source.stop(0);
    };

    function onTimeUpdate() {
        $scope.$apply(function() {
            $scope.livestream.progress = audio.currentTime;
        });
    }

    function onDurationChange() {
        $scope.$apply(function() {
            $scope.livestream.duration = audio.duration;
        });
    }
    function onCanPlay() {
        $scope.$apply(function() {
            $scope.livestream.loaded = true;
        });
    }

    $scope.startStream  = function() {
        context = new AudioContext();

        audio = new Audio();
        audio.preload = 'metadata';
        audio.src = $scope.livestream.url;
        audio.addEventListener('timeupdate', onTimeUpdate, false);
        audio.addEventListener('durationchange', onDurationChange, false);
        audio.addEventListener('canplay', onCanPlay, false);

        var source = context.createMediaElementSource(audio);
        source.connect(context.destination);

        audio.play();
    };
    $scope.stopStream = function() {
        audio.pause();
    };
  }]);
