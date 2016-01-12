myApp.config(function($stateProvider, $urlRouterProvider){
/*
    $stateProvider.state('site', {
        'abstract': true,
        views: {
            'header@': {
                templateUrl: 'views/header/view.html',
                controller: 'HeaderController'
            },
            'footer@': {
                templateUrl: 'views/footer/view.html',
                controller: 'FooterController'
            }
        }
    });
*/
    $stateProvider.state('inicio', {
        url: '/',
        parent: '',
        views: {
            'content@': {
                templateUrl: 'views/inicio/view.html',
                controller: 'InicioController'
            }
        }
    });

    $stateProvider.state('modo-coaster', {
        url: '/modo-coaster/:barCode',
        parent: '',
        views: {
            'content@': {
                templateUrl: 'views/modo-coaster/view.html',
                controller: 'ModoCoasterController'
            }
        }
    });

    $stateProvider.state('seleccion-turno', {
        url: '/seleccion-turno',
        parent: 'site',
        views: {
            'content@': {
                templateUrl: 'views/seleccion-turno/view.html',
                controller: 'SeleccionTurnoController'
            }
        }
    });

    $stateProvider.state('monitor-turno', {
        url: '/monitor-turno',
        parent: 'site',
        views: {
            'content@': {
                templateUrl: 'views/monitor-turno/view.html',
                controller: 'MonitorTurnoController'
            }
        }
    });

    $stateProvider.state('atencion-turno', {
        url: '/atencion-turno',
        parent: 'site',
        views: {
            'content@': {
                templateUrl: 'views/atencion-turno/view.html',
                controller: 'AtencionTurnoController'
            }
        }
    });

    $stateProvider.state('fin-turno', {
        url: '/fin-turno',
        parent: 'site',
        views: {
            'content@': {
                templateUrl: 'views/fin-turno/view.html',
                controller: 'FinTurnoController'
            }
        }
    });
});