'use strict';


shared.directive('dataComponent', function(sharedDataService) {
    return {
        restrict: 'E',
        controller: function($scope, $attrs, sharedDataService) {
            $scope.$on('handleBroadcast', function() {
                $scope.message = 'D: ' + sharedDataService.message;
            });
        },
        replace: true,
        template: '<input>'
    };
});
