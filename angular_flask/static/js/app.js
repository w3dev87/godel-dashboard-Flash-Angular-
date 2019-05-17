'use strict';
// 'ngMaterial', 'ngMessages', 'material.svgAssetsCache'
angular.module('GodelDashboard', ['ngRoute', 'ui.bootstrap', "ngSanitize", "ngCsv","ui.tab.scroll",'googlechart','angular-dygraphs','acute.select'])
	.config(['$routeProvider', '$locationProvider',
		function($routeProvider, $locationProvider) {
		$routeProvider
		.when('/', {
			templateUrl: 'static/partials/mainview.html',
			controller: LoginController,
			resolve: LoginController.resolve
		})
		.when('/about', {
			templateUrl: 'static/partials/about.html',
			controller: AboutController
		})
		.when('/dashboard', {
			templateUrl: 'static/partials/mainview.html',
			controller: LoginController,
			resolve: LoginController.resolve
		})
		.when('/login_opt', {
			redirectTo:'/login'
		})
		.when('/login', {
			redirectTo:'/login'
		})
		.when('/logout', {
			redirectTo:'/logout'
		})
		.when('/realtime', {
			templateUrl: 'templates/realtime.html',
			controller: LoginController,
			resolve: LoginController.resolve
		})

		.when('/acsmetric', {
			templateUrl: '/realtime_dashboard',
			controller: MetricCtrl,
			resolve: MetricCtrl.resolve
		})
		.when('/admin', {
			templateUrl: 'templates/admin.html',
			controller: AdminController,
			resolve: AdminController.resolve
		})
		.when('/faq', {
			templateUrl: 'templates/faq.html',
			controller: LoginController,
			resolve: LoginController.resolve
		})
		.when('/custom_query', {
			templateUrl: 'templates/custom_query.html',
			controller: QueryController,
			resolve: QueryController.resolve
		})
		.otherwise({
			redirectTo: '/'
		})
		;

		$locationProvider.html5Mode(false);
	}])
;
