/*
* v1.3.0
* TODO: Add dynamic track support (watch for the "track" parameter)
* TODO: Adds playlist support
* Complete rewrite of MediaManager and new IonicMedia class based on promises
* */

angular.module('ionic-audio', ['ionic'])
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
    .filter('duration', ['$filter', function($filter) {
        return function (input) {
            return (input > 0) ? $filter('time')(input) : '';
        }
    }])
    .service('IonicMedia', ['$q', '$interval', function ($q, $interval) {
      var q, mediaStatus = null, mediaPosition = -1, mediaTimer, mediaDuration = -1;

      function setTimer(media) {
          if (angular.isUndefined(q)) return;
          if (angular.isDefined(mediaTimer)) return;

          mediaTimer = $interval(function () {
              if (mediaDuration < 0) {
                  mediaDuration = media.getDuration();
                  mediaDuration > 0 && q.notify({duration: mediaDuration});
              }

              media.getCurrentPosition(
                // success callback
                function (position) {
                    if (position && position > -1) {
                        mediaPosition = position;
                        q.notify({position: mediaPosition});
                    }
                },
                // error callback
                function (e) {
                    console.log("ionic-audio: error getting media position " + e);
                });

          }, 1000);
      }

      function clearTimer() {
          if (angular.isDefined(mediaTimer)) {
              $interval.cancel(mediaTimer);
              mediaTimer = undefined;
          }
      }

      function resetValues() {
          mediaPosition = -1;
          mediaDuration = -1;
      }

      function IonicMedia(src) {
          this.media = new Media(src,
            function (success) {
                clearTimer();
                resetValues();
                q.resolve(success);
            }, function (error) {
                clearTimer();
                resetValues();
                q.reject(error);
            }, function (status) {
                mediaStatus = status;
                q.notify({status: mediaStatus});
            });
      }

      // iOS quirks :
      // -  myMedia.play({ numberOfLoops: 2 }) -> looping
      // -  myMedia.play({ playAudioWhenScreenIsLocked : false })
      IonicMedia.prototype.play = function (options) {
          q = $q.defer();

          if (typeof options !== "object") {
              options = {};
          }

          this.media.play(options);

          setTimer(this.media);

          return q.promise;
      };

      IonicMedia.prototype.pause = function () {
          clearTimer();
          this.media.pause();
      };

      IonicMedia.prototype.stop  = function () {
          this.media.stop();
      };

      IonicMedia.prototype.release  = function () {
          this.media.release();
          this.media = undefined;
      };

      IonicMedia.prototype.seekTo  = function (timing) {
          this.media.seekTo(timing);
      };

      IonicMedia.prototype.setVolume = function (volume) {
          this.media.setVolume(volume);
      };

      IonicMedia.prototype.getStatus = function () {
          return mediaStatus;
      };

      return IonicMedia;

    }])
    .factory('MediaFactory', ['IonicMedia', function (IonicMedia) {
      return {
          createMedia: function (src) {
              return new IonicMedia(src);
          }
      };
    }])
    .factory('MediaManager', ['MediaFactory', '$window', function(MediaFactory, $window) {
        var tracks = [], currentTrack, currentMedia;

        if (!$window.cordova && !$window.Media) {
            console.log("ionic-audio: missing Cordova Media plugin.");
            return null;
        }

        var createMedia = function(track) {
            if (!track.url) {
                console.log('ionic-audio: missing track url');
                return undefined;
            }

            return MediaFactory.createMedia(track.url);
        };

        /*
        Creates a new Media from a track object

         var track = {
             url: 'https://s3.amazonaws.com/ionic-audio/Message+in+a+bottle.mp3',
             artist: 'The Police',
             title: 'Message in a bottle',
             art: 'img/The_Police_Greatest_Hits.jpg'
         }
         */
        return {
            add: function(track) {
                if (!track.url) {
                    console.log('ionic-audio: missing track url');
                    return;
                }

                track.id  = tracks.push(track) - 1;
                return track.id;
            },

            instance: function(trackID) {
                if (currentMedia) {
                    currentMedia.stop();
                    currentMedia.release();
                }

                currentTrack = tracks[trackID];

                currentMedia = createMedia(currentTrack);

                return currentMedia;
            },

            isPlaying: function(trackID) {
                return currentTrack && currentTrack.id == trackID;
            },

            seekTo: function(pos) {
                currentMedia && currentMedia.seekTo(pos * 1000);
            },

            destroy: function() {
                currentMedia && currentMedia.release();
            }
        }

    }])
    .directive('ionAudioTrack', ['MediaManager', '$timeout', '$rootScope', function(MediaManager, $timeout, $rootScope) {
        return {
            transclude: true,
            template: '<ng-transclude></ng-transclude>',
            restrict: 'E',
            scope: {
                track: '='
            },
            controller: ['$scope', '$element', function($scope, $element) {
                var media,
                  hasOwnProgressBar = $element.find('ion-audio-progress-bar').length > 0;

                var init = function() {
                    $scope.track.progress = 0;
                    $scope.track.status = 0;
                    $scope.track.duration = -1;

                    if (MediaManager) {
                        $scope.track.id = MediaManager.add($scope.track);
                    }
                };

                var playbackSuccess = function() {
                    $scope.track.status = 0;
                    $scope.track.progress = 0;
                    media = undefined;
                };

                var updateTrackData = function(data) {
                    data.position && ($scope.track.progress = data.position);
                    data.status && ($scope.track.status = data.status);
                    data.duration && ($scope.track.duration = data.duration);
                };

                var notifyProgressBar = function() {
                    $rootScope.$broadcast('ionic-audio:trackChange', $scope.track);
                };

                var start = function() {
                    $timeout(function() {
                        media.play().then(playbackSuccess, null, updateTrackData);
                    }, 300);
                };

                $scope.track.play = function() {
                    if (!MediaManager) return;

                    // first time this track is being played
                    if (!media) {
                        media = MediaManager.instance($scope.track.id);

                        // start playback
                        start();
                        // notify global progress bar if detached from track
                        if (!hasOwnProgressBar) notifyProgressBar();

                        return;
                    }

                    // this track is currently playing or paused
                    if (MediaManager.isPlaying($scope.track.id)) {
                        var status = media.getStatus();

                        if (status === Media.MEDIA_RUNNING) {
                            media.pause();
                        } else if (status === Media.MEDIA_PAUSED) {
                            // resume
                            start();
                        }
                    }
                };

                init();

                $scope.$on('$destroy', function() {
                    MediaManager.destroy();
                });
            }]
        }
    }])
    .directive('ionAudioControls', [function() {
        return {
          restrict: 'EA',
          controller: ['$scope', '$element', function($scope, $element) {
              var spinnerElem = $element.find('ion-spinner'), hasLoaded, self = this;

              spinnerElem.addClass('ng-hide');

              this.toggleSpinner = function() {
                  spinnerElem.toggleClass('ng-hide');
              };

              this.play = function() {
                  if (!hasLoaded) {
                      self.toggleSpinner();
                  }
                  $scope.track.play();
              };

              var unbindStatusListener = $scope.$watch('track.status', function (status) {
                  switch (status) {
                      case 1: // Media.MEDIA_STARTING
                          hasLoaded = false;
                          break;
                      case 2: // Media.MEDIA_RUNNING
                          if (!hasLoaded) {
                              self.toggleSpinner();
                              hasLoaded = true;
                          }
                          break;
                      //case 3: // Media.MEDIA_PAUSED
                      //    break;
                      case 0: // Media.MEDIA_NONE
                      case 4: // Media.MEDIA_STOPPED
                          hasLoaded = false;
                          break;
                  }
              });

              $scope.$on('$destroy', function() {
                  unbindStatusListener();
              });
          }]
        }
    }])
    .directive('ionAudioPlay', ['$ionicGesture', function($ionicGesture) {
        return {
            restrict: 'A',
            require: '^^ionAudioControls',
            link: function(scope, element, attrs, controller) {
                var isLoading, debounce, currentStatus = 0;
                
                var init = function() {
                    isLoading = false;
                    element.addClass('ion-play');
                    element.removeClass('ion-pause');
                    element.text(attrs.textPlay);
                };

                var setText = function() {
                    if (!attrs.textPlay || !attrs.textPause) return;

                    element.text((element.text() == attrs.textPlay ? attrs.textPause : attrs.textPlay));
                };

                var togglePlaying = function() {
                    element.toggleClass('ion-play ion-pause');
                    setText();
                };

                $ionicGesture.on('tap', function() {
                    // debounce while loading and multiple clicks
                    if (debounce || isLoading) {
                        debounce = false;
                        return;
                    }

                    controller.play();
                    togglePlaying();
                    if (currentStatus == 0) isLoading = true;
                }, element);

                $ionicGesture.on('doubletap', function() {
                    debounce = true;
                }, element);

                var unbindStatusListener = scope.$watch('track.status', function (status) {
                    //  Media.MEDIA_NONE or Media.MEDIA_STOPPED
                    if (status == 0 || status == 4) {
                        init();
                    } else if (status == 2) {   // Media.MEDIA_RUNNING
                        isLoading = false;
                    }

                    currentStatus = status;
                });

                init();

                scope.$on('$destroy', function() {
                    unbindStatusListener();
                });
            }
        }
    }])
    .directive('ionAudioProgressBar', ['MediaManager', function(MediaManager) {
        return {
            restrict: 'E',
            template:
                '<h2 class="ion-audio-track-info" ng-style="displayTrackInfo()">{{track.title}} - {{track.artist}}</h2>' +
                '<div class="range">' +
                '<ion-audio-progress track="track"></ion-audio-progress>' +
                '<input type="range" name="volume" min="0" max="{{track.duration}}" ng-model="track.progress" on-release="sliderRelease()" disabled>' +
                '<ion-audio-duration track="track"></ion-audio-duration>' +
                '</div>',
            link: function(scope, element, attrs) {
                var slider =  element.find('input'), unbindTrackListener;

                function init() {
                    scope.track.progress = 0;
                    scope.track.status = 0;
                    scope.track.duration = -1;
                }

                if (!angular.isDefined(attrs.displayTime)) {
                    element.find('ion-audio-progress').remove();
                    element.find('ion-audio-duration').remove();
                }
                if (!angular.isDefined(attrs.displayInfo)) {
                    element.find('h2').remove();
                }

                if (angular.isUndefined(scope.track)) {
                    scope.track = {};

                    // listens for track changes elsewhere in the DOM
                    unbindTrackListener = scope.$on('ionic-audio:trackChange', function (e, track) {
                        scope.track = track;
                    });
                }

                // hide/show track info if available
                scope.displayTrackInfo = function() {
                    return { visibility: angular.isDefined(attrs.displayInfo) && (scope.track.title || scope.track.artist) ? 'visible' : 'hidden'}
                };

                // handle track seek-to
                scope.sliderRelease = function() {
                    var pos = scope.track.progress;
                    MediaManager.seekTo(pos);
                };

                // disable slider if track is not playing
                var unbindStatusListener = scope.$watch('track.status', function(status) {
                    // disable if track hasn't loaded
                    slider.prop('disabled', status == 0);   // Media.MEDIA_NONE
                });

                init();

                scope.$on('$destroy', function() {
                    unbindStatusListener();
                    if (angular.isDefined(unbindTrackListener)) {
                        unbindTrackListener();
                    }
                });
            }
        }
    }])
    .directive('ionAudioProgress', [function() {
        return {
            restrict: 'E',
            scope: {
                track: '='
            },
            template: '{{track.progress | time}}'
        }
    }])
    .directive('ionAudioDuration', [function() {
        return {
            restrict: 'E',
            scope: {
                track: '='
            },
            template: '{{track.duration | duration}}'
        }
    }]);
