myApp.controller('InicioController', function($rootScope, $scope, $interval, $cordovaBarcodeScanner){
    $scope.omitirScaneo = false;
    $scope.mensaje = "";

    $rootScope.$watch('message', function(){
        $scope.mensaje = $rootScope.message;
    });

    $scope.validarDispositivo = function() {
        if($rootScope.deviceReady && (networkSSID == "" || networkPassword == "")){
            if($scope.omitirScaneo)
                return;

            $scope.omitirScaneo = true;

            $cordovaBarcodeScanner.scan().then(function(imageData) {
                var values = imageData.text.split(";");

                if(values.length >= 3){
                    networkSSID = values[1].substring(2);
                    networkPassword = values[2].substring(2);

                    localStorage.setItem("networkSSID", networkSSID);
                    localStorage.setItem("networkPassword", networkPassword);
                }else{
                    $scope.omitirScaneo = false;
                }
            }, function(error) {
                $rootScope.message = "Error al escanear QR [" + error + "]";
                $scope.omitirScaneo = false;
            });
        }
    };

    var timerValidarDispositivo = $interval($scope.validarDispositivo, 1000);

    $scope.$on('$destroy', function() {
        if (angular.isDefined(timerValidarDispositivo)) {
            $interval.cancel(timerValidarDispositivo);

            timerValidarDispositivo = undefined;
        }
    });
});