myApp.controller('AtencionTurnoController', function($scope, $state){
    $scope.mostrarPantallaFinTurno = function(){
        $state.go('fin-turno');
    };
});