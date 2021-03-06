myApp.controller('InicioController', function($rootScope, $scope, $interval, $cordovaBarcodeScanner){
    $scope.omitirScaneo = false;
    $scope.mensaje = "";
	$scope.mensajeITRACKQ = {};
	
    $rootScope.$watch('message', function(){
        $scope.mensaje = $rootScope.message;
    });
	
	$rootScope.$on('mensaje-recibido', function(event, args) {
        $scope.mensajeITRACKQ = args;
    });

    $scope.validarDispositivo = function() {
        if(networkSSID == "" || networkPassword == "" || iTrackQHost == "" || iTrackQPort == ""){
            if($scope.omitirScaneo)
                return;

            $scope.omitirScaneo = true;

            $cordovaBarcodeScanner.scan().then(function(imageData) {
				var str = imageData.text.replace(new RegExp("&#34;", 'g'), '"');
				var jsonObj = JSON.parse(str);
				
                if(str.length > 0){
                    networkSSID = jsonObj.SSID;
                    networkPassword = jsonObj.SSPWD;
					iTrackQHost = jsonObj.ITrackQHost;
					iTrackQPort = jsonObj.ITrackQPort;

                    localStorage.setItem("networkSSID", networkSSID);
                    localStorage.setItem("networkPassword", networkPassword);
					localStorage.setItem("iTrackQHost", iTrackQHost);
					localStorage.setItem("iTrackQPort", iTrackQPort);
					
					$rootScope.$broadcast('webSocketDataUpdated');
                }else{
                    $scope.omitirScaneo = false;
                }
            }, function(error) {
                $rootScope.message = "Error al escanear QR [" + error + "]";
                $scope.omitirScaneo = false;
            });
        }
    };

    var timerValidarDispositivo = $interval($scope.validarDispositivo, 2500);

    $scope.$on('$destroy', function() {
        if (angular.isDefined(timerValidarDispositivo)) {
            $interval.cancel(timerValidarDispositivo);

            timerValidarDispositivo = undefined;
        }
    });
});
