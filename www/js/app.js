var myApp = angular.module('itrackq-coaster', ['ui.router', 'ngCordova', 'ngWebsocket', 'ngSanitize']);
var networkSSID = localStorage.getItem("networkSSID") == null ? "" : localStorage.getItem("networkSSID");
var networkPassword = localStorage.getItem("networkPassword") == null ? "" : localStorage.getItem("networkPassword");
var iTrackQHost = localStorage.getItem("iTrackQHost") == null ? "" : localStorage.getItem("iTrackQHost");
var iTrackQPort = localStorage.getItem("iTrackQPort") == null ? "" : localStorage.getItem("iTrackQPort");
var coasterID = localStorage.getItem("coasterID") == null ? "" : localStorage.getItem("coasterID");
var sessionID = localStorage.getItem("sessionID") == null ? "" : localStorage.getItem("sessionID");

myApp.run(function ($rootScope, $interval, $state, $websocket) {
    $rootScope.deviceReady = false;
    $rootScope.isConnecting = false;
    $rootScope.networkConnected = false;

    var wsURL = 'ws://' + iTrackQHost + ':' + iTrackQPort +'/intellitrackq/clientWebSocket';

    var ws = $websocket.$new({
        url: wsURL,
        reconnect: true,
        reconnectInterval: 5000, // it will reconnect after 0.5 seconds
		enqueue: true,
        lazy: true
    });

    $rootScope.mostrarLogWiFi = function(data){
        cordova.plugins.backgroundMode.configure({
            text: data
        });

        $rootScope.message = data;
    };

    $state.go('inicio');

    document.addEventListener("backbutton", function(){
        ws.$emit('client-disconnect', '');

        cordova.plugins.backgroundMode.disable();
        navigator.app.exitApp();
    }, false);

    document.addEventListener("deviceready", function() {
        if (window.cordova && window.cordova.plugins.Keyboard)
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

        if (window.StatusBar)
            StatusBar.styleDefault();

        cordova.plugins.backgroundMode.enable();

        cordova.plugins.backgroundMode.setDefaults({
            title: 'ITrackQ',
            text : 'Ejecutando aplicacion en modo background.'
        })

        $rootScope.deviceReady = true;
    }, false);

    $rootScope.mostrarLogWiFi("Iniciando aplicacion.");

    // ********************************************************************************************************
    // ***************************** Mensajes para la conexion WebSocket ***********************************
    // ********************************************************************************************************

    ws.$on('$open', function () {
        console.log("WebSocket open");

        if(coasterID != ""){
            ws.$emit('client-reconnect-request', {sessionID: sessionID, coasterID: coasterID});
        }else{
            ws.$emit('client-connect-request', '');
        }
    });

    ws.$on('client-connect-ok', function (message) {
        coasterID = message.coasterID;
		sessionID = message.sessionID;

        localStorage.setItem("coasterID", coasterID);
		localStorage.setItem("sessionID", sessionID);
		
        $state.go('modo-coaster', {barCode: coasterID});
    });

    ws.$on('client-display-message', function (data) {
        $rootScope.$broadcast('mensaje-recibido', data);
    });

    ws.$on('$close', function () {
        console.log("WebSocket closed");
    });

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
            if(error == null){
                callbackNotConnected();
            }else{
                callbackError('getCurrentSSID [' + error + ']');
            }
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

    $rootScope.$watch('networkConnected', function(){
        if($rootScope.networkConnected){
            ws.$open();
        }
    });

    // Primer intento de conexion con la RED WiFi
    $rootScope.getWifiStatus();

    var timerGetWifiStatus = $interval($rootScope.getWifiStatus, 10000);
});
