/*
* v1.3.0
* Adds dynamic track support (watches for the "track" parameter)
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
            controller: ['$scope', function($scope) {
                var media, controller = this;

                $scope.track.progress = 0;
                $scope.track.status = 0;
                $scope.track.duration = -1;

                var playbackSuccess = function() {
                    console.log('finished playback');
                    $scope.track.status = 0;
                    $scope.track.progress = 0;
                    media = undefined;
                };

                var updateTrackData = function(data) {
                    console.log('track progress: ' + data.position);
                    data.position && ($scope.track.progress = data.position);

                    console.log('track status change: ' + data.status);
                    data.status && ($scope.track.status = data.status);

                    console.log('track duration: ' + data.duration);
                    data.duration && ($scope.track.duration = data.duration);
                };

                var notifyProgressBar = function() {
                    $rootScope.$broadcast('ionic-audio:trackChange', $scope.track);
                };

                var start = function() {
                    console.log('ionic-audio: playing track ' + $scope.track.title);

                    $timeout(function() {
                        media.play().then(playbackSuccess, null, updateTrackData);
                    }, 300);
                };

                this.play = function() {
                    if (!MediaManager) return;

                    // first time this track is being played
                    if (!media) {
                        media = MediaManager.instance($scope.track.id);

                        // start playback
                        start();

                        // notify global progress bar if detached from track
                        if (!controller.hasOwnProgressBar) notifyProgressBar();

                        return;
                    }

                    // this track is currently playing or paused
                    if (MediaManager.isPlaying($scope.track.id)) {
                        var status = media.getStatus();

                        if (status === Media.MEDIA_RUNNING) {
                            console.log('ionic-audio: pausing track ' + $scope.track.title);
                            media.pause();
                        } else if (status === Media.MEDIA_PAUSED) {
                            // resume
                            console.log('ionic-audio: resuming track ' + $scope.track.title);
                            start();
                        }
                    }

                    return $scope.track.id;
                };

                this.getTrack = function() {
                    return $scope.track;
                };

                if (MediaManager) {
                    $scope.track.id = MediaManager.add($scope.track);
                }
            }],
            link: function(scope, element, attrs, controller) {
                controller.hasOwnProgressBar = element.find('ion-audio-progress-bar').length > 0;

                scope.$on('$destroy', function() {
                    MediaManager.destroy();
                });
            }
        }
    }])
    .directive('ionAudioControls', [function() {
        return {
          restrict: 'EA',
          scope: {},
          require: ['ionAudioControls', '^^ionAudioTrack'],
          controller: ['$scope', '$element', function($scope, $element) {
              var spinnerElem = $element.find('ion-spinner'), hasLoaded, self = this;

              spinnerElem.addClass('ng-hide');

              this.toggleSpinner = function() {
                  spinnerElem.toggleClass('ng-hide');
              };

              this.playTrack = function() {
                  if (!hasLoaded) {
                      self.toggleSpinner();
                  }
                  self.play();
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
          }],
          link: function(scope, element, attrs, controllers) {
              var ionAudioTrackCtrl = controllers[1];
              controllers[0].play = ionAudioTrackCtrl.play;

              scope.track = ionAudioTrackCtrl.getTrack();
          }
        }
    }])
    .directive('ionAudioPlay', [function() {
        return {
            //scope: true,
            restrict: 'A',
            require: ['^^ionAudioTrack', '^^ionAudioControls'],
            link: function(scope, element, attrs, controllers) {
                var isLoading, currentStatus = 0;
                
                scope.track = controllers[0].getTrack();
                
                var controller = controllers[1];

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

                element.on('click', function() {
                    if (isLoading) return;  //  debounce multiple clicks

                    controller.playTrack();
                    togglePlaying();
                    if (currentStatus == 0) isLoading = true;
                });

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
            require: '?^^ionAudioTrack',
            scope: {},
            link: function(scope, element, attrs, controller) {
                var slider =  element.find('input'), unbindTrackListener;

                scope.track = {
                    progress: 0,
                    status: 0,
                    duration: -1
                };

                if (!angular.isDefined(attrs.displayTime)) {
                    element.find('ion-audio-progress').remove();
                    element.find('ion-audio-duration').remove();
                }
                if (!angular.isDefined(attrs.displayInfo)) {
                    element.find('h2').remove();
                }

                // hide/show track info if available
                scope.displayTrackInfo = function() {
                    return { visibility: angular.isDefined(attrs.displayInfo) && (scope.track.title || scope.track.artist) ? 'visible' : 'hidden'}
                };

                // disable slider if track is not playing
                var unbindStatusListener = scope.$watch('track.status', function(status) {
                    // disable if track hasn't loaded
                    slider.prop('disabled', status == 0);   //   Media.MEDIA_NONE
                });

                if (controller) {
                    // get track from parent audio track directive
                    scope.track = controller.getTrack();
                } else {
                    // get track from current playing track elsewhere in the DOM
                    unbindTrackListener = scope.$on('ionic-audio:trackChange', function (e, track) {
                        scope.track = track;
                    });
                }

                // handle track seek-to
                scope.sliderRelease = function() {
                    var pos = scope.track.progress;
                    MediaManager.seekTo(pos);
                };

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
