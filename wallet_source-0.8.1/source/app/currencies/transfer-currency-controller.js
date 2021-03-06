/******************************************************************************
 * Copyright © 2017 XIN Community                                             *
 *                                                                            *
 * See the DEVELOPER-AGREEMENT.txt and LICENSE.txt files at  the top-level    *
 * directory of this distribution for the individual copyright  holder        *
 * information and the developer policies on copyright and licensing.         *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement, no part of the    *
 * XIN software, including this file, may be copied, modified, propagated,    *
 * or distributed except according to the terms contained in the LICENSE.txt  *
 * file.                                                                      *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

angular.module('currencies').controller('TransferCurrencyFormController',
    ['$scope', 'CurrenciesService', 'SessionStorageService', '$state', 'CryptoService', 'loginConfig',
        'AlertService', 'alertConfig', '$validation', '$uibModal', 'multiStepFormScope', 'FeeService', '$rootScope',
        'CommonsService',
        function ($scope, CurrenciesService, SessionStorageService, $state, CryptoService,
                  loginConfig, AlertService, alertConfig, $validation, $uibModal, multiStepFormScope, FeeService,
                  $rootScope, CommonsService) {


            $scope.transferCurrencyForm = angular.copy(multiStepFormScope.transferCurrencyForm);

            $scope.initStep1 = function () {
                var data = $scope.$getActiveStep().data;
                if (data) {

                    $scope.transferCurrencyForm.currencyId = data.currencyId;
                    $scope.transferCurrencyForm.decimals = data.decimals;
                    $scope.transferCurrencyForm.ticker = data.ticker;
                }
            };

            $scope.nextStep = function () {
                var currencyForm = $scope.transferCurrencyForm;
                if (currencyForm.currencyId && currencyForm.decimals !== undefined && currencyForm.ticker) {
                    $scope.$nextStep();
                } else {
                    CurrenciesService.getCurrencyById(currencyForm.currencyId).then(function (success) {
                        if (success.currency) {
                            $scope.transferCurrencyForm.currencyId = success.currency;
                            $scope.transferCurrencyForm.decimals = success.decimals;
                            $scope.transferCurrencyForm.ticker = success.code;
                            $scope.$nextStep();
                        } else {
                            AlertService.addAlert(
                                {
                                    type: 'danger',
                                    msg: 'Sorry, an error occured! Reason: ' + success.errorDescription
                                }, alertConfig.transferCurrencyModalAlert
                            );
                        }
                    }, function (error) {
                        AlertService.addAlert(AlertService.getNoConnectionMessage(error),
                            alertConfig.transferCurrencyModalAlert);
                    });
                }
            };

            $scope.$on('$destroy', function () {
                multiStepFormScope.transferCurrencyForm = angular.copy($scope.transferCurrencyForm);
            });

            $scope.openAddressBookModal = function () {
                var modalInstance = $uibModal.open({
                    animation: false,
                    templateUrl: 'addressbook/views/addressbook-light.html',
                    controller: 'AddressBookCtrl',
                    resolve: {
                        params: function () {
                            return {
                                'closeOnClick': true
                            };
                        }
                    }
                });
                modalInstance.result.then(function (result) {
                    $scope.transferCurrencyForm.recipient = result.accountRS;
                });
            };


            $scope.hasPrivateKeyInSession = function () {
                if (SessionStorageService.getFromSession(loginConfig.SESSION_ACCOUNT_PRIVATE_KEY)) {
                    return true;
                }
                return false;
            };

            $scope.transferCurrency = function () {
                var transferCurrencyForm = multiStepFormScope.transferCurrencyForm;
                var currency = transferCurrencyForm.currencyId;
                var units = parseInt(transferCurrencyForm.units * Math.pow(10, transferCurrencyForm.decimals));
                var fee = 1;
                var recipientRS = transferCurrencyForm.recipient;
                var publicKey = CommonsService.getAccountDetailsFromSession('publicKey');
                var secret = transferCurrencyForm.secretPhrase;
                var secretPhraseHex;
                if (secret) {
                    secretPhraseHex = CryptoService.secretPhraseToPrivateKey(secret);
                } else {
                    secretPhraseHex =
                        SessionStorageService.getFromSession(loginConfig.SESSION_ACCOUNT_PRIVATE_KEY);
                }
                if (!fee) {
                    fee = 1;
                }
                $scope.transferCurrencyPromise = CurrenciesService.transferCurrency(publicKey, recipientRS, currency,
                    units, fee)
                    .then(function (success) {
                        if (!success.errorCode) {
                            var unsignedBytes = success.unsignedTransactionBytes;
                            var signatureHex = CryptoService.signatureHex(unsignedBytes, secretPhraseHex);
                            $scope.transactionBytes =
                                CryptoService.signTransactionHex(unsignedBytes, signatureHex);

                            $scope.validBytes = true;

                            $scope.tx_fee = success.transactionJSON.feeTQT / 100000000;
                            $scope.tx_amount = success.transactionJSON.amountTQT / 100000000;
                            $scope.tx_total = $scope.tx_fee + $scope.tx_amount;

                        } else {
                            AlertService.addAlert(
                                {
                                    type: 'danger',
                                    msg: 'Sorry, an error occured! Reason: ' + success.errorDescription
                                }, alertConfig.transferCurrencyModalAlert
                            );
                        }
                    }, function (error) {
                        AlertService.addAlert(AlertService.getNoConnectionMessage(error),
                            alertConfig.transferCurrencyModalAlert);
                    });

            };

            $scope.broadcastTransaction = function (transactionBytes) {
                $scope.transferCurrencyPromise = CommonsService.broadcastTransaction(transactionBytes)
                    .then(function (success) {
                        $scope.$emit('close-modal');
                        $rootScope.$broadcast('reload-dashboard');
                        if (!success.errorCode) {
                            AlertService.addAlert(
                                {
                                    type: 'success',
                                    msg: 'Transaction succesfull broadcasted with Id : ' + success.transaction +
                                    ''
                                });
                            // $state.go('client.signedin.account.pending');
                        } else {
                            AlertService.addAlert(
                                {
                                    type: 'danger',
                                    msg: 'Unable to broadcast transaction. Reason: ' + success.errorDescription
                                });
                        }

                    }, function (error) {
                        AlertService.addAlert(AlertService.getNoConnectionMessage(error),
                            alertConfig.transferCurrencyModalAlert);
                    });
            };

        }]);
