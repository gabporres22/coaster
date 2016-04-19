function handleWebSocket(){
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
}