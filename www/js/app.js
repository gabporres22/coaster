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

        /*
         * Inicio la conexion WebSocket y su mensajeria
         */

        $rootScope.$on('webSocketConnect', function(){
            var autoReconnect = true;
            var clientConnected = false;
            var registerServerRequestSended = false;

            $rootScope.mostrarLogConsola("Inicializando conexion WebSocket");

            var ws = $websocket.$new({
                url: 'ws://' + iTrackQHost + ':' + iTrackQPort + '/intellitrackq/clientWebSocket',
                reconnect: false,
                lazy: true
            });

            // ********************************************************************************************************
            // ***************************** Mensajes para la conexion WebSocket **************************************
            // ********************************************************************************************************

            function registrarCoasterServer(){
                if(coasterID != ""){
                    ws.$emit('client-reconnect-request', {sessionID: sessionID, coasterID: coasterID});
                }else{
                    ws.$emit('client-connect-request', '');
                }

                registerServerRequestSended = true;
            };

            ws.$on('$open', function () {
                $rootScope.mostrarLogConsola("WebSocket [open]");

                webSocketConnected = true;

                $interval(function(){
                    if(autoReconnect && webSocketConnected && !clientConnected && !registerServerRequestSended){
                        $rootScope.mostrarLogConsola("Intentado registrarse en el servidor");

                        registrarCoasterServer();
                    }
                }, 5000);

            });

            ws.$on('$error', function(error){
                $rootScope.mostrarLogConsola("WebSocket Error [" + error + "]");
            });

            ws.$on('non-free-coasters-available', function(message){
                registerServerRequestSended = false;

                $rootScope.mostrarLogConsola("Error en la conexion [Sin coasters dispnibles]");

                $state.go('inicio');

                $rootScope.$broadcast('mensaje-recibido', {messageType: 'CONNECTION-ERROR', data: 'Procesando su solicitud, aguarde un momento.'});
            });

            ws.$on('error-connection-request', function(message){
                registerServerRequestSended = false;

                $rootScope.mostrarLogConsola("Error en la conexion [" + message + "]");

                $state.go('inicio');

                $rootScope.$broadcast('mensaje-recibido', {messageType: 'CONNECTION-ERROR', data: message});
            });

            ws.$on('client-connect-ok', function (message) {
                clientConnected = true;

                $rootScope.mostrarLogConsola("Conectado a servidor ITrackQ");

                coasterID = message.coasterID;
                sessionID = message.sessionID;

                localStorage.setItem("coasterID", coasterID);
                localStorage.setItem("sessionID", sessionID);

                $state.go('modo-coaster', {barCode: coasterID});
            });

            ws.$on('client-display-message', function (data) {
                var obj = JSON.parse(data);

                $rootScope.mostrarLogConsola("DisplayMessage [" + data + "]");

                $rootScope.$broadcast('mensaje-recibido', obj);

                if(obj.messageType == "PRESENTARSE_CAJA"){
                    $rootScope.mostrarMensajeBarra("DIRIJASE A " + obj.label + " " + obj.numeroCaja);
                }

                if(obj.messageType == "INICIO"){
                    $rootScope.mostrarMensajeBarra("Gracias por su compra !");

                    $timeout(function(){
                        ws.$emit('client-remove-request', sessionID);

                        $rootScope.mostrarLogConsola("Finalizando WebSocket");

                        ws.$close();

                        localStorage.setItem("coasterID", "");
                        localStorage.setItem("sessionID", "");

                        cordova.plugins.backgroundMode.disable();
                        navigator.app.exitApp();
                    }, 5000);
                }
            });

            ws.$on('$close', function () {
                $rootScope.mostrarLogConsola("WebSocket [close]");

                webSocketConnected = false;
                clientConnected = false;
                registerServerRequestSended = false;

                $rootScope.mostrarLogConsola("WebSocket desconectado");

                if(autoReconnect){
                    $state.go('inicio');
                    $rootScope.$broadcast('mensaje-recibido', {messageType: 'DISCONNECT', data: 'Se ha perdido la conectividad con el servidor. Aguarde un momento por favor.'});

                    ws.$open();
                }
            });

            $rootScope.$on('webSocketDisconnect', function(){
                ws.$emit('client-disconnect', sessionID);

                autoReconnect = false;
                webSocketConnected = false;
                connectionRequestWait = false;

                $rootScope.mostrarLogConsola("Cerrando WebSocket");

                ws.$close();
            });

            /*
             *  Inicio la conexion WebSocket
             */
            if($rootScope.networkConnected){
                ws.$open();
            }
        });

        /*
         * Configuro el boton de Volver para salir de la app
         */

        document.addEventListener("backbutton", function() {
            /**
             * Muestra el alerta para confirmar la salida de la app
             */
            navigator.notification.confirm("Confirma salir de la aplicación y cancelar su turno ?", function (buttonIndex) {
                if (buttonIndex == 1) {
                    $rootScope.$broadcast('webSocketDisconnect');

                    localStorage.setItem("coasterID", "");
                    localStorage.setItem("sessionID", "");

                    cordova.plugins.backgroundMode.disable();
                    navigator.app.exitApp();
                }
            }, "Cerrar aplicación", ['Aceptar', 'Cancelar'])
        }, false);

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
