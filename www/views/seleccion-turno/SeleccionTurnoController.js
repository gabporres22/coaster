myApp.controller('SeleccionTurnoController', function($scope, $state){
    $scope.mostrarPantallaMonitorTurno = function(){
        $state.go('monitor-turno');
    };
});