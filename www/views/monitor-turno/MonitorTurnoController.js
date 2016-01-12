myApp.controller('MonitorTurnoController', function($scope, $state){
    $scope.mostrarPantallaAtencionTurno = function(){
        $state.go('atencion-turno');
    };
});