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

var connectionRequestWait = false;

myApp.run(function ($rootScope, $interval, $state, $websocket) {

    document.addEventListener("deviceready", function() {
        if (window.cordova && window.cordova.plugins.Keyboard)
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

        if (window.StatusBar)
            StatusBar.styleDefault();

        cordova.plugins.backgroundMode.enable();

        cordova.plugins.backgroundMode.setDefaults({
            title: 'ITrackQ',
            text : 'Ejecutando aplicacion en modo background.'
        });

        $rootScope.isConnecting = false;
        $rootScope.networkConnected = false;

        $rootScope.mostrarMensajeBarra = function(data){
            cordova.plugins.backgroundMode.configure({
                text: data
            });

            navigator.vibrate([500, 500, 1000]);
        };

        $rootScope.mostrarLogWiFi = function(data){
            console.log(data);

            $rootScope.message = data;
        };   

        // ********************************************************************************************************
        // **************************** Helpers para la conectividad del dispositivo ******************************
        // ********************************************************************************************************

        $rootScope.habilitarWifi = function(callbackStarted, callbackStarting, callbackError){
            $rootScope.mostrarLogWiFi("Chequeando estado de WiFi");

            WifiWizard.isWifiEnabled(function(response){
                if(response){
                    $rootScope.mostrarLogWiFi("WiFi habilitada.");
                    callbackStarted();
                }else{
                    $rootScope.mostrarLogWiFi("Habilitando WiFi");

                    WifiWizard.setWifiEnabled(true, function(response){
                        callbackStarting();
                    }, function(error){
                        callbackError('setWifiEnabled [' + error + ']');
                    });
                }
            }, function(error){
                callbackError('isWifiEnabled [' + error + "]");
            });
        };

        $rootScope.validarConexionRed = function(ssid, callbackConnected, callbackNotConnected, callbackError){
            WifiWizard.getCurrentSSID(function(response) {
                response = response.replace(/"/g, '');

                if (response == ssid) {
                    callbackConnected();
                } else {
                    callbackNotConnected();
                }
            }, function(error){
                callbackNotConnected();
            });
        };

        $rootScope.buscarRed = function(ssid, callbackFounded, callbackNotFounded, callbackError){
            $rootScope.mostrarLogWiFi("Buscando redes disponibles");

            WifiWizard.startScan(function(){
                WifiWizard.getScanResults(function(response){
                    if(response.length > 0){
                        var ssidFound = false;

                        for(var index = 0; index < response.length; index++){
                            if(response[index].SSID === ssid){
                                ssidFound = true;
                                break;
                            }
                        }

                        if(ssidFound) {
                            callbackFounded();
                        }else{
                            callbackNotFounded();
                        }
                    }else{
                        callbackNotFounded();
                    }
                }, function(error){
                    callbackError('getScanResults [' + error + "]");
                });
            }, function(error){
                callbackError('startScan [' + error + "]");
            });
        };

        $rootScope.conectarWifi = function(ssid, password, callbackConnected, callbackError){
            if($rootScope.isConnecting)
                return;

            $rootScope.mostrarLogWiFi("Desconectando red actual");

            WifiWizard.disconnect(function(){
                $rootScope.mostrarLogWiFi("Buscando la red deseada");

                WifiWizard.listNetworks(function(response){
                    var ssidFound = false;

                    if(response.length > 0){
                        for(var index = 0; index < response.length; index++){
                            if(response[index] === ssid){
                                ssidFound = true;
                                break;
                            }
                        }

                        if(ssidFound){
                            $rootScope.mostrarLogWiFi("Red encontrada ! Conectando ...");
                            $rootScope.isConnecting = true;

                            WifiWizard.connectNetwork(ssid, function(){
                                callbackConnected();
                            }, function(error){
                                $rootScope.isConnecting = false;

                                callbackError('connectNetwork [' + error + "]");
                            });
                        }
                    }

                    if(response.length == 0 || !ssidFound) {
                        // *** No existe la red en la memoria del dispositivo ***

                        $rootScope.buscarRed(ssid, function () {
                            // *** Red encontrada ***
                            $rootScope.mostrarLogWiFi("Configurando la red");

                            console.log("SSID[" + networkSSID+ "] Password[" + networkPassword + "]");

                            WifiWizard.addNetwork(WifiWizard.formatWPAConfig(ssid, password), function () {
                                $rootScope.mostrarLogWiFi("Conectando a la red ...");
                                $rootScope.isConnecting = true;

                                WifiWizard.connectNetwork(ssid, function () {
                                    callbackConnected();
                                }, function (error) {
                                    $rootScope.isConnecting = false;

                                    callbackError('connectNetwork [' + error + "]");
                                });
                            }, function (error) {
                                callbackError('addNetwork [' + error + "]");
                            });
                        }, function () {
                            // *** Red no encontrada ***

                            callbackError('buscarRed [RED NO ENCONTRADA]');
                        }, function (errorMsg) {
                            // *** Error escaneando red ***

                            callbackError('buscarRed [' + errorMsg + ']');
                        });
                    }
                }, function(error){
                    callbackError('listNetworks [' + error + "]");
                });
            }, function(error){
                callbackError('disconnect [' + error + "]");
            });
        };

        // ********************************************************************************************************
        // *********************** Metodo que se ejecuta cada X tiempo para mantener la conexion ******************
        // ********************************************************************************************************

        $rootScope.getWifiStatus = function(){
            if(networkSSID == "" || networkPassword == "")
                return;

            $rootScope.habilitarWifi(function(){
                // *** Wifi habilitada ***
                $rootScope.mostrarLogWiFi("WiFi habilitada, validando conexion actual.");

                $rootScope.validarConexionRed(networkSSID, function(){
                    // *** Conectado a la red requerida
                    $rootScope.mostrarLogWiFi("Conectado a la red requerida.");

                    $rootScope.networkConnected = true;
                }, function(){
                    // *** Conectado a otra red ***
                    $rootScope.mostrarLogWiFi("Conectado a otra red, intentando conexion a red requerida");

                    $rootScope.conectarWifi(networkSSID, networkPassword, function(){
                        // *** Conectado ***
                        $rootScope.networkConnected = true;
                    }, function(errorMsg){
                        // *** Error al conectar con la Red Wifi ***
                        $rootScope.mostrarLogWiFi(errorMsg);
                    });
                }, function(errorMsg){
                    // *** Error al validar la conexion ***

                    $rootScope.mostrarLogWiFi(errorMsg);
                });
            }, function(){
                // *** Iniciando Wifi, espero X segundos al proximo ciclo de validacion ***

                $rootScope.mostrarLogWiFi("Habilitando red WiFi");
            }, function(errorMsg){
                // *** Error al habilitar Wifi ***

                $rootScope.mostrarLogWiFi(errorMsg);
            });
        };

		$rootScope.$on('webSocketDataUpdated', function(){
            var ws = $websocket.$new({
                url: 'ws://' + iTrackQHost + ':' + iTrackQPort + '/intellitrackq/clientWebSocket',
                reconnect: true,
                reconnectInterval: 1000,
                enqueue: true,
                lazy: true
            });

			// ********************************************************************************************************
			// ***************************** Mensajes para la conexion WebSocket **************************************
			// ********************************************************************************************************

			ws.$on('$open', function () {
				console.log("WebSocket open");

                if(!connectionRequestWait){
                    if(coasterID != ""){
                        ws.$emit('client-reconnect-request', {sessionID: sessionID, coasterID: coasterID});
                    }else{
                        ws.$emit('client-connect-request', '');
                    }

                    connectionRequestWait = true;
                }
            });

			ws.$on('client-connect-ok', function (message) {
				coasterID = message.coasterID;
				sessionID = message.sessionID;

				localStorage.setItem("coasterID", coasterID);
				localStorage.setItem("sessionID", sessionID);

                connectionRequestWait = false;

				$state.go('modo-coaster', {barCode: coasterID});
			});

			ws.$on('client-display-message', function (data) {
				var obj = JSON.parse(data);

				console.log("DisplayMessage [" + data + "]");

				if(obj.messageType == "PRESENTARSE_CAJA"){
                    $rootScope.mostrarMensajeBarra("DIRIJASE A " + obj.label + " " + obj.numeroCaja);
				}

				$rootScope.$broadcast('mensaje-recibido', obj);

                if(obj.messageType == "INICIO"){
                    $rootScope.mostrarMensajeBarra("Gracias por su compra !. " + obj.sucursal.nombre);

                    $timeout(function(){
                        $rootScope.$broadcast('ws-discconnect');

                        localStorage.setItem("coasterID", "");
                        localStorage.setItem("sessionID", "");

                        cordova.plugins.backgroundMode.disable();
                        navigator.app.exitApp();
                    }, 5000);
                }
			});

			ws.$on('$close', function () {
				console.log("WebSocket closed");
			});
			
			$rootScope.$on('ws-discconnect', function(){
				ws.$emit('client-disconnect', sessionID);
				ws.$close();

                connectionRequestWait = false;
			});
			
			ws.$open();
        });
		
        $rootScope.$watch('networkConnected', function(){
            if($rootScope.networkConnected){
                $rootScope.$broadcast('webSocketDataUpdated');
            }
        });

        document.addEventListener("backbutton", function(){
        	navigator.notification.confirm("Confirma salir de la aplicación y cancelar su turno ?", function(buttonIndex){
        		if(buttonIndex == 1){
        			$rootScope.$broadcast('ws-discconnect');

		            localStorage.setItem("coasterID", "");
		            localStorage.setItem("sessionID", "");
		
		            cordova.plugins.backgroundMode.disable();
		            navigator.app.exitApp();
        		}
        	}, "Cerrar aplicación", ['Aceptar', 'Cancelar'])
        }, false);

        $state.go('inicio');

        window.plugins.insomnia.keepAwake();

        var timerGetWifiStatus = $interval($rootScope.getWifiStatus, 10000);

        $rootScope.getWifiStatus();
    }, false);
});
