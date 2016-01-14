myApp.controller('ModoCoasterController', function($rootScope, $scope){
    $scope.mensaje = "";
    $scope.mensajeITRACKQ = {};

    $scope.$on('mensaje-recibido', function(event, args) {
        $scope.mensajeITRACKQ = args;
    });

    $rootScope.$watch('message', function(){
        $scope.mensaje = $rootScope.message;
    });

    var obj = {
        format: "EAN",
        displayValue: true,
        fontSize: 28
    };

    $scope.calculateCheckDigitEan13 = function() {
        var factor = 3;
        var sum = 0;

        for (index = coasterID.length; index > 0; --index) {
            sum = sum + coasterID.substring (index-1, index) * factor;
            factor = 4 - factor;
        }

        var cc = ((1000 - sum) % 10);
        var result =  coasterID + cc;

        return result;
    }

    //$("#barCode").JsBarcode(coasterID + '0', obj);
    $("#barCode").JsBarcode($scope.calculateCheckDigitEan13(), obj);
});
