/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */

define(["N/search", "N/record", "N/cache", "N/log", "N/error",],
    function (search, record, cache, log, error) {
        function _post(context) {
            try {
                if (context != null && context != "") {
                    var recidArr = [];

                    for (var i = 0; i < context.length; i++) {
                        var contextObj = context[i];
                        log.debug("contextObj", contextObj);

                        var salesOrderId = contextObj.salesOrderId;
                        var trandate = contextObj.trandate;
                        var ifStage = contextObj.ifStage;
                        var memo = contextObj.memo;

                        var itemList = contextObj.itemList;

                        var tranDetail = search.lookupFields({
                            type: record.Type.SALES_ORDER,
                            id: salesOrderId,
                            columns: 'status'
                        });
                        var soStatusDetail = tranDetail.status
                        var soStatus = soStatusDetail[0].text

                        if (soStatus == "Partially Fulfilled" || soStatus == "Pending Fulfillment") {
                            var itemFulfillmentObj = record.transform({
                                fromType: record.Type.SALES_ORDER,
                                fromId: salesOrderId,
                                toType: record.Type.ITEM_FULFILLMENT,
                                isDynamic:true
                                
                            });

                            if (trandate) {
                                itemFulfillmentObj.setText("trandate", trandate);
                            }

                            if (memo) {
                                itemFulfillmentObj.setValue("memo", memo);
                            }

                            itemFulfillmentObj.setValue("shipstatus", "B");

                            if (ifStage) {
                                itemFulfillmentObj.setValue("custbody_xxflx_fulfillmentstage", ifStage);
                            }

                            /// configure item fulfillment line label value
                            if (itemList) {
                                for (var j = 0; j < itemList.length; j++) {
                                    var itemlistObject = itemList[j];

                                    var item = itemlistObject.item;
                                    var location = itemlistObject.location;
                                    var quantity = itemlistObject.quantity;
                                    var inventoryDetail = itemlistObject.inventoryDetail;// this is inventory detail configuration

                                    var checkLotSerial = fetchItemLotOrSerial(item);
                                    log.debug('checkLotSerial for item:', JSON.stringify(checkLotSerial) + '(item:)' + item)

                                    var itemLine = itemFulfillmentObj.findSublistLineWithValue({
                                        sublistId: 'item',
                                        fieldId: 'item',
                                        value: item
                                    });


                                    if (itemLine >= 0) {
                                        itemFulfillmentObj.selectLine({
                                            sublistId: 'item',
                                            line: itemLine
                                        });

                                        itemFulfillmentObj.setCurrentSublistValue({
                                            sublistId: "item",
                                            fieldId: "itemreceive",
                                            value: true,
                                        });

                                        if (quantity) {
                                            itemFulfillmentObj.setCurrentSublistValue({
                                                sublistId: "item",
                                                fieldId: "quantity",
                                                value: quantity,
                                            });
                                        }
                                        
                                        if (location) {
                                            itemFulfillmentObj.setCurrentSublistValue({
                                                sublistId: "item",
                                                fieldId: "location",
                                                value: location,
                                            });
                                        }

                                        /// configure inventory details configuration
                                        if (checkLotSerial.isSerialized == true || checkLotSerial.isLot == true) {
                                            if (inventoryDetail) {
                                                var inventoryDetails = itemFulfillmentObj.getSublistSubrecord({
                                                    sublistId: 'item', // inventory or item
                                                    fieldId: 'inventorydetail',
                                                    line:0

                                                });



                                                for (var k = 0; k < inventoryDetail.length; k++) {
                                                    var lotSerialNo = inventoryDetail[k].lotSerialNo
                                                    var qty = inventoryDetail[k].qty
                                                    var status = inventoryDetail[k].status

                                                    inventoryDetails.selectNewLine({
                                                        sublistId: 'inventoryassignment'
                                                    });

                                                    if (lotSerialNo) {
                                                        inventoryDetails.setCurrentSublistValue({
                                                            sublistId: 'inventoryassignment',
                                                            fieldId: 'issueinventorynumber',
                                                            value: lotSerialNo,
                                                            line:0
                                                        });
                                                    }
                                                    if (qty) {
                                                        inventoryDetails.setCurrentSublistValue({
                                                            sublistId: 'inventoryassignment',
                                                            fieldId: 'quantity',
                                                            value: qty,
                                                            line:0
                                                        });
                                                    }

                                                    if (status) {
                                                        inventoryDetails.setCurrentSublistValue({
                                                            sublistId: 'inventoryassignment',
                                                            fieldId: 'inventorystatus',
                                                            value: status,
                                                            line:0
                                                        });
                                                    }

                                                    inventoryDetails.commitLine({
                                                        sublistId: 'inventoryassignment'
                                                    });
                                                }
                                            }
                                            else {
                                                throw 'no inventory detail found for a lot/serial controlled item'
                                            }
                                        }

                                     


                                    }
                                    else {
                                        throw 'items not found for fulfilment'
                                    }
                                    itemFulfillmentObj.commitLine({
                                        sublistId: "item",
                                    });
                                }
                            }

                            var itemFulfillmentId = itemFulfillmentObj.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true,
                            });
                            log.debug("itemFulfillmentId", itemFulfillmentId);
                            if (itemFulfillmentId) {
                                recidArr.push(itemFulfillmentId);
                            }
                        }
                    }

                    if (recidArr.length > 0) {
                        return {
                            success: true,
                            status: "200",
                            created: "Records Created Successfully : " + recidArr
                        };
                    } else {
                        return {
                            success: false,
                            status: "500",
                            message: "No Records Created"
                        };
                    }
                }
            } catch (err) {
                log.debug({
                    title: "POST",
                    details: JSON.stringify(err),
                });
                return err;
            }
        }

        ///// GET |||
        function get(datain) {
            try {
                if (!isEmpty(datain)) {
                    //var recIdArr = []
                    // for (var i = 0; i < datain.length; i++) {
                    var contextObj = datain[i];
                    log.debug('contextObj', contextObj)

                    var ifId = datain.ifId;
                    var ifStatus = datain.ifStatus;

                    if (!isEmpty(ifId) && !isEmpty(ifStatus)) {

                        record.submitFields({
                            type: record.Type.ITEM_FULFILLMENT,
                            id: ifId,
                            values: { 'custbody_xxflx_fulfillmentstage': ifStatus },
                        })
                        return "IF has been updated successfully, Id: " + ifId
                    }
                    // }
                }
            } catch (e) {
                log.debug(e.name, e.message);
                return {
                    success: false,
                    status: "500",
                    message: e.message
                };
            }
        }
        function fetchItemLotOrSerial(item) {
            var isSerialized;
            var isLot;
            if (item != null && item != '') {
                var itemSearchObj = search.create({
                    type: "item",
                    filters: [
                        ["internalid", "is", item]
                    ],
                    columns: [
                        search.createColumn({
                            name: "isserialitem"
                        }),
                        search.createColumn({
                            name: "islotitem"
                        })
                    ]
                });

                var cols = itemSearchObj.columns;
                var searchResultCount = itemSearchObj.runPaged().count;

                itemSearchObj.run().each(function (result) {
                    isSerialized = result.getValue(cols[0]);
                    isLot = result.getValue(cols[1]);
                    log.debug('isSerialized', isSerialized);
                    log.debug('isLot', isLot);

                    return true;
                });
            }
            return {
                isSerialized: isSerialized,
                isLot: isLot
            };
        }
        function isEmpty(obj) {
            return obj == null || obj == '' || obj == undefined;
        }
        return {
            post: _post,
            get: get,
        };
    });