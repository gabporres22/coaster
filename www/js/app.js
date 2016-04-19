var myApp = angular.module('itrackq-coaster', ['ui.router', 'ngCordova', 'ngWebsocket', 'ngSanitize']);

function obtenerValorLocalStorage(entry){
	var value = localStorage.getItem(entry);
	
	if( (value === undefined) || (value == null) || (value == "undefined") ){
		return null;
	}else{
		return value;
	}
}

var networkSSID = obtenerValorLocalStorage("networkSSID") == null ? "" : obtenerValorLocalStorage("networkSSID");
var networkPassword = obtenerValorLocalStorage("networkPassword") == null ? "" : obtenerValorLocalStorage("networkPassword");

var iTrackQHost = obtenerValorLocalStorage("iTrackQHost") == null ? "localhost" : obtenerValorLocalStorage("iTrackQHost");
var iTrackQPort = obtenerValorLocalStorage("iTrackQPort") == null ? "12345" : obtenerValorLocalStorage("iTrackQPort");

var coasterID = obtenerValorLocalStorage("coasterID") == null ? "" : obtenerValorLocalStorage("coasterID");
var sessionID = obtenerValorLocalStorage("sessionID") == null ? "" : obtenerValorLocalStorage("sessionID");

var webSocketConnected = false;

myApp.run(function ($rootScope, $interval, $timeout, $state, $websocket, $filter) {
    $rootScope.isConnecting = false;
    $rootScope.networkConnected = false;

    $rootScope.mostrarMensajeBarra = function(data){
        cordova.plugins.backgroundMode.configure({
            text: data
        });

        $timeout(function(){
            navigator.notification.vibrate([500, 500, 1000]);
            navigator.notification.beep(3);
        }, 2000);

    };

    $rootScope.mostrarLogWiFi = function(data){
        $rootScope.message = data;

        $rootScope.mostrarLogConsola(data);
    };

    $rootScope.mostrarLogConsola = function(message){
        console.log($filter('date')(new Date(),'dd/MM/yyyy HH:mm:ss.sss') + " - " + message);
    };

    document.addEventListener("deviceready", function() {
        if (window.cordova && window.cordova.plugins.Keyboard)
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

        if (window.StatusBar)
            StatusBar.styleDefault();

        cordova.plugins.backgroundMode.enable();

        cordova.plugins.backgroundMode.setDefaults({
            title: 'ITrackQ',
            text : 'Hasar Sistemas'
        });

        /*
         * Chequea el estado del conector WiFi y llama al metodo de conexion
         */
        $rootScope.checkWifiStatus = function(){
            if(networkSSID == "" || networkPassword == "")
                return;

            WifiWizard.isWifiEnabled(function(enabled){
                if(enabled){
                    $rootScope.conectarWifi();
                }else{
                    $rootScope.isConnecting = true;

                    WifiWizard.setWifiEnabled(true, function(response){
                        if(response == "OK"){
                            $rootScope.conectarWifi();
                        }
                    }, function(error){
                        $rootScope.mostrarLogConsola("setWifiEnabled ERROR [" + error + "]");
                    });
                }
            }, function(error){
                $rootScope.mostrarLogConsola("isWifiEnabled ERROR[" + error + "]");
            });
        };

        /*
         * Chequea la conexion actual y trata de conectarse a la SSID deseada
         */

        $rootScope.conectarWifi = function(){
            WifiWizard.getCurrentSSID(function(currentSSID) {
                currentSSID = currentSSID.replace(/"/g, '');

                $rootScope.mostrarLogConsola("getCurrentSSID [" + currentSSID + "]");

                if (currentSSID == networkSSID) {
                    $rootScope.isConnecting = false;
                    $rootScope.networkConnected = true;
                } else {
                    WifiWizard.disconnect(function(){
                        WifiWizard.addNetwork(WifiWizard.formatWPAConfig(networkSSID, networkPassword), function () {
                            $rootScope.isConnecting = true;

                            WifiWizard.connectNetwork(networkSSID, function () {
                                $rootScope.isConnecting = false;
                                $rootScope.networkConnected = true;
                            }, function (error) {
                                $rootScope.mostrarLogConsola("connectNetwork ERROR [" + error + "]");
                            });
                        }, function (error) {
                            $rootScope.mostrarLogConsola("addNetwork ERROR [" + error + "]");
                        });
                    }, function(error){
                        $rootScope.mostrarLogConsola("disconnect ERROR [" + error + "]");
                    });
                }
            }, function(error){
                $rootScope.mostrarLogConsola("getCurrentSSID ERROR [" + error + "]");
            });
        };

        $rootScope.$watch('networkConnected', function(){
            if($rootScope.networkConnected){
                $rootScope.$broadcast('webSocketConnect');
            }else{
                $rootScope.$broadcast('webSocketDisconnect');
            }
        });

        $rootScope.$on('webSocketConnect', handleWebSocket());

        /**
         * Muestra el alerta para confirmar la salida de la app
         */
        $rootScope.mostrarConfirmacionCierre = function(){
            navigator.notification.confirm("Confirma salir de la aplicación y cancelar su turno ?", function(buttonIndex){
                if(buttonIndex == 1){
                    $rootScope.$broadcast('webSocketDisconnect');

                    localStorage.setItem("coasterID", "");
                    localStorage.setItem("sessionID", "");

                    cordova.plugins.backgroundMode.disable();
                    navigator.app.exitApp();
                }
            }, "Cerrar aplicación", ['Aceptar', 'Cancelar']);
        };

        /*
         * Configuro el boton de Volver para salir de la app
         */

        document.addEventListener("backbutton", $rootScope.mostrarConfirmacionCierre(), false);

        /*
         * Inicio la pantalla grafica y el modo de operacion continuo
         */

        $state.go('inicio');

        window.plugins.insomnia.keepAwake();

        /*
         * Ejecuto el timer cada 10 segundos para validar la conexion contra el servidor
         */

        var timerGetWifiStatus = $interval($rootScope.checkWifiStatus, 10000);

        $rootScope.checkWifiStatus();
    }, false);
});
