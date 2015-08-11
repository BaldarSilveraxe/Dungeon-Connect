/*global state, sendChat, filterObjs, getObj, on, createObj, log, setTimeout, _, DungeonConnectWalls, findObjs, playerIsGM, sendPing, toFront */
/*jslint white: true, bitwise: true, for: true */

var DungeonConnect = DungeonConnect || (function(){
    'use strict';
    
    var version = 0.2,
        lastUpdate = 1439207564, //Unix timestamp
        schemaVersion = 0.2, 
        
        defaultWalls = 'Simple_Stone',
        wallTextures = [],
        stateIndexX = [],
        stateIndexM = [],
        stateIndexP = [],
        stateIndexG = [],
        stateIndexABBA = [],
        pathUpdated = [],
        nodeUpdated = [],
        stateFeatureIndexFeature = [],
        stateFeatureIndexGM = [],


// ~~~> utilities <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        deferred = {
            batchSize: 30,
            initialDefer: 10,
            batchDefer: 10
        },
        deferredCreateObj = (function(){
            var queue = [], creator,
            doCreates = function(){
                var done = 0,
                    request;
                while(queue.length && ++done < deferred.batchSize ){
                    request = queue.shift();
                    createObj(request.type,request.properties);
                }
                if( queue.length ){
                    creator = setTimeout(doCreates, deferred.batchDefer );
                } else {
                    creator = false;
                }
            };
            return function(type,properties){
            queue.push({type: type, properties: properties});
            if(!creator){
                creator = setTimeout(doCreates, deferred.initialDefer );
            }
        };
        }()),
        utilities = (function(){
            var macrosInstall = function() {
                    var toggleIcon = 'https://s3.amazonaws.com/files.d20.io/images/8434850/ijzdctgdJpFj_Q2NC9GFvg/thumb.png?1427221316',
                        controller = findObjs({ type: 'character', name: 'Door-And-Torch-Control'})[0] || 
                        createObj('character', {name: 'Door-And-Torch-Control', avatar: toggleIcon}),
                        ability = findObjs({type: 'ability', name: '⇕-Toggle-Feature', characterid: controller.get('id')})[0] || 
                        createObj('ability', {name: '⇕-Toggle-Feature', characterid: controller.get('id'), action: '!DungeonConnectToggle', istokenaction: true});
                    return controller.get('id');
                },
                getMapCenterSquare = function() {
                    var page = getObj('page', state.DungeonConnect.page || Campaign().get('playerpageid'));
                    return {x: (Math.floor(page.get('width') / 2) * 70) + 35,y: (Math.floor(page.get('height') / 2) * 70) + 35};
                },
                deferredWall = function(x,y,tile,path,page,rot) {
                    var  removeWall = findObjs({pageid: page, type: 'graphic', layer: 'map', name: 'wallpart', left: x, top: y });
                    _.each(removeWall, function(obj) {
                        obj.remove();
                    });
                    deferredCreateObj('graphic', {
                        pageid: page, imgsrc: tile, name: 'wallpart', left: x, top: y, width: 70, height: 70, layer: 'map', controlledby: path, rotation: rot
                    });
                },
                checkAngle = function(ax,ay,bx,by) {
                    var ty = by - ay, tx = bx - ax, theta = Math.atan2(ty, tx);
                    theta *= 180 / Math.PI;
                    return theta;
                },
                bitDirection = function(x1,y1,x2,y2) {
                    var na,bitValue = 256;
                    x1 = parseInt(x1);
                    y1 = parseInt(y1);
                    x2 = parseInt(x2);
                    y2 = parseInt(y2);
                    na = Math.round(utilities.PathAngle(x1,y1,x2,y2));
                    switch(na){
                        case 45:   bitValue = 128; break;
                        case 90:   bitValue = 64;  break;
                        case 135:  bitValue = 32;  break;
                        case 180:  bitValue = 16;  break;
                        case -135: bitValue = 8;   break;
                        case -90:  bitValue = 4;   break;
                        case -45:  bitValue = 2;   break;
                        case 0:    bitValue = 1;   break;
                    }
                    return bitValue;
                },
                intersects = function (a,b,c,d,p,q,r,s) {
                    var det, gamma, lambda;
                    det = (c - a) * (s - q) - (r - p) * (d - b);
                    if (det === 0) {
                      return false;
                    } else {
                      lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
                      gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
                      return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
                    }
                },
                clearMap = function (message) {
                    var nodes, middle, paths, mapParts, feature, control, pageid = state.DungeonConnect.page || Campaign().get('playerpageid');
                    if ( 'y' !== message.content.split(' ')[1].toLowerCase() ) {return; }
                    nodes = findObjs({pageid: pageid, type: 'graphic', controlledby: 'DungeonConnectPost' });
                    _.each(nodes, function(obj) {obj.set('controlledby','remove'); delete stateIndexX[obj.get('id')]; obj.remove(); });
                    middle = findObjs({pageid: pageid, type: 'graphic', controlledby: 'MiddlePost' });
                    _.each(middle, function(obj) {obj.set('controlledby','remove'); delete stateIndexM[obj.get('id')]; obj.remove(); });
                    paths = findObjs({pageid: pageid, type: 'path', controlledby: 'DungeonConnectPath' });
                    _.each(paths, function(obj) {obj.set('controlledby','remove'); delete stateIndexP[obj.get('id')]; obj.remove(); });
                    feature = findObjs({pageid: pageid, type: 'graphic', controlledby: 'feature' });
                    _.each(feature, function(obj) {obj.set('controlledby','remove'); delete state.DungeonConnectFeatures[obj.get('id')]; obj.remove(); });
                    control = findObjs({pageid: pageid, type: 'graphic', controlledby: 'controller' });
                    _.each(control, function(obj) {obj.set('controlledby','remove'); delete stateFeatureIndexGM[obj.get('id')]; obj.remove(); });
                    mapParts = findObjs({pageid: pageid,  type: 'graphic',  layer: 'map' });
                    _.each(mapParts, function(obj) {obj.remove(); });
                },
                fill = function () {
                    var center = getMapCenterSquare(),
                        findBucket = findObjs({                              
                            pageid: state.DungeonConnect.page || Campaign().get('playerpageid'),                              
                            type: 'graphic', layer: 'gmlayer', controlledby: 'FillBucket'
                        });
                    if( 0 !== findBucket.length ) {
                        sendPing(findBucket[0].get('left'), findBucket[0].get('top'), findBucket[0].get('pageid'), null, true);
                        return; 
                    }
                    deferredCreateObj('graphic', {
                        pageid: state.DungeonConnect.page || Campaign().get('playerpageid'), 
                        imgsrc: 'https://s3.amazonaws.com/files.d20.io/images/11095197/tt3UYlxHJQJKkcbxI2yFnw/thumb.jpg?1437997243', 
                        name: 'FillBucket', left: center.x, top: center.y, width: 70, height: 70, layer: 'gmlayer', controlledby: 'FillBucket'
                    });
                },
                pathingRotation = function(angle, point,width,height) {
                    var pointX = point[0], pointY = point[1], originX = (width/2), originY = (height/2);
                    angle = angle * Math.PI / 180.0;
                    return [
                        Math.cos(angle) * (pointX-originX) - Math.sin(angle) * (pointY-originY) + originX,
                        Math.sin(angle) * (pointX-originX) + Math.cos(angle) * (pointY-originY) + originY
                    ];
                },
                placeRotatedFlipPaths = function(givenPathData) {
                    var temp, i, newX, newY, inputPath, angle, Xoffset, Yoffset, PathArray, maxX, minX, maxY, minY, objectWidth, objectHeight,
                        objectTop, objectLeft, pathString, graphicID; 
                    _.each(givenPathData, function(given) {
                        temp = [];
                        for(i = 0; i < given.path.length; i = i + 1) {
                            newX = given.path[i][0];
                            newY = given.path[i][1];
                            if(given.fliph){newX = given.width - given.path[i][0]; }
                            if(given.flipv){newY = given.height - given.path[i][1]; }
                            temp.push([newX, newY]);
                        }
                        given.path = temp;
                        graphicID = given.forID;
                        inputPath = given.path;
                        angle = given.rotation;
                        Xoffset = given.left - (given.width/2);
                        Yoffset = given.top - (given.height/2);
                        PathArray = []; 
                        if(!angle) {angle = 0; }
                        if(!Xoffset) {Xoffset = 0; }
                        if(!Yoffset) {Yoffset = 0; }
                        maxX = 0;
                        minX = false;
                        maxY = 0;
                        minY = false;
                        for(i = 0; i < inputPath.length; i = i + 1) {
                            PathArray.push([inputPath[i][0], inputPath[i][1]]);
                            PathArray[i] = pathingRotation(angle, PathArray[i],given.width,given.height);
                            if(PathArray[i][0] > maxX) {maxX = PathArray[i][0]; }
                            if(minX === false || Number(PathArray[i][0]) < Number(minX)) {minX = PathArray[i][0]; }
                            if(PathArray[i][1] > maxY) {maxY = PathArray[i][1]; }
                            if(minY === false || PathArray[i][1] < minY) {minY = PathArray[i][1]; }
                        }
                        objectWidth = maxX - minX;
                        objectHeight = maxY - minY;
                        objectTop = minY + (objectHeight/2); 
                        objectLeft = minX + (objectWidth/2);
                        for(i = 0; i < PathArray.length; i = i + 1) {
                            PathArray[i][0] = PathArray[i][0] - minX;
                            PathArray[i][1] = PathArray[i][1] - minY;
                        }
                        pathString = "";
                        for(i = 0; i < PathArray.length; i = i + 1) {
                            if(i !== 0) {
                                pathString += ",[\"L\"," + PathArray[i][0] + "," + PathArray[i][1] + "]";
                            } else {
                                pathString = "[\[\"M\"," + PathArray[i][0] + "," + PathArray[i][1] + "]";  
                            }
                        }
                        pathString += "\]";
                        objectTop = objectTop + Yoffset; 
                        objectLeft = objectLeft + Xoffset;
                        given.path = pathString;
                        given.left = objectLeft;
                        given.top = objectTop;
                        createObj('path',{ 
                            pageid: given.page, layer: 'walls', path: given.path, left: given.left, top: given.top,
                            width: objectWidth, height: objectHeight, rotation: 0, fliph: false, flipv: false,
                            stroke: given.stroke, stroke_width: given.strokewidth, controlledby: graphicID
                        });
                    });  
                },
                fillCancel = function () {
                    var findBuckets = findObjs({type: 'graphic', layer: 'gmlayer', controlledby: 'FillBucket' });
                    _.each(findBuckets, function(obj) {obj.set('controlledby','remove'); obj.remove(); });
                };
                
        return {
                PathAngle: checkAngle,
                BitDirection: bitDirection,
                GetMapCenterSquare: getMapCenterSquare,
                DeferredWall: deferredWall,
                Intersects: intersects,
                ClearMap: clearMap,
                Fill: fill,
                FillCancel: fillCancel,
                MacrosInstall: macrosInstall,
                PlaceRotatedFlipPaths: placeRotatedFlipPaths
            };
        }()),
// ~~~> utilities <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~



// ~~~> Chat Output <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        chatOutput = (function(){
            var criticalSRC = 'https://s3.amazonaws.com/files.d20.io/images/6422880/SIjBHWJNC8f9a73Rg_VkOQ/thumb.png?14164996807',
                caution_SRC = 'https://s3.amazonaws.com/files.d20.io/images/6422879/M-oWEvMt1bhC2M-bdi28tA/thumb.png?1416499678',
                border = '#FF0000', background = '#FFBABA', color = '#D8000C', who = '/direct ', src, text = 'Error',
                cssButtonAnchor = ' style="border: 1px solid AliceBlue; background-color: SteelBlue; color: white;" ',
                cssButtonSpan = ' style="color: white; font-weight: normal; display: block; width: 150px;" ',
                cssButtonAnchorImg  = ' style="border: 1px solid Black; background-color: White; color: white;" ',
                cssButtonImg  = ' style="padding: 0px 0px 0px 0px; outline: none; border: none;" ',
                cssButtonAnchor2 = ' style="border: 1px solid SandyBrown; background-color: Tomato; color: white;" ',
                help = function() {
                    sendChat('Dungeon Connect','/w "' + state.DungeonConnect.who + '" <br>'
                        + '<a href="https://app.roll20.net/forum/post/2283776/script-dungeon-connect-over-70-tiles-for-use-with-api-line-segment-script/?pageforid=2283776#post-2283776">'
                        +'<u>LINK: Find help on the forum!</u></a>');
                },
                alertMessage  = function(input) {
                    var message = input.text;
                    switch(input.type) {
                        case 'Caution':
                            src = caution_SRC;
                            if( _.has(state,'DungeonConnect') ) { who = '/w "' + state.DungeonConnect.who + '" '; }
                            border = '#9F6000'; background = '#FEEFB3'; color = '#9F6000'; message = '<b>Caution.</b> ' + message;
                        break;
                        default: src = criticalSRC; message = '<b>Script Halted.</b> ' + message; break;
                    }
                    text = who + '<div style="padding:1px 3px; border: 1px solid ' 
                        + border + '; background: ' + background + '; color: ' + color + '; font-size: 80%;">'
                        + '<img src="' + src + '" style="vertical-align: text-bottom; width:20px; height:20px; padding: 0px 5px;" />' 
                        + message + '<br>' + '<a href="!DungeonConnectHelp" style="padding:0px 0px;border: 0px; border-collapse: collapse'
                        + 'color: ' + color + '; font-size: 100%; background: ' + background + '">'
                        + '<span style="color: ' + color + '; font-size: 80%;"><b>?-Help</b></span></a> | '
                        + '<a href="!DungeonConnectMenu" style="padding:0px 0px;border: 0px; border-collapse: collapse'
                        + 'color: ' + color + '; font-size: 100%; background: ' + background + '">'
                        + '<span style="color: ' + color + '; font-size: 80%;"><b>Main-Menu</b></span></a>';
                    sendChat('Dungeon Connect', text);
                },
                cellhtml = function(href,aStyle,url,imgStyle) {
                    var html = '<div style="display: table-cell; border-collapse: collapse; padding-left: 0px; padding-right: 0px;" >'
                            +'<a href="' + href + '"' + aStyle + '>'
                                +'<img src="' + url + '" height="50" width="50" border="0"' + imgStyle + '>'
                            +'</a>'
                        +'</div>';
                    return html; 
                },
                mainMenu = function(input) {
                    var menuText;
                    text = input.text;
                    sendChat('Dungeon Connect Tools', '/w '  + state.DungeonConnect.who  + ' ');
                    if( 'more' !== text ) {
                        menuText = '/w '  + state.DungeonConnect.who  + ' '
                        + '<div style="display: table;" >'
                            + '<div style="display: table-row;" >'
                                + cellhtml('!DungeonConnectFeature DCF_001', cssButtonAnchorImg,_.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_001'})[0].url,cssButtonImg)
                                + cellhtml('!DungeonConnectFeature DCF_002', cssButtonAnchorImg,_.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_002'})[0].url,cssButtonImg)
                            + '</div>'
                            + '<div style="display: table-row;" >'
                                + cellhtml('!DungeonConnectFeature DCF_003', cssButtonAnchorImg,_.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_003'})[0].url,cssButtonImg)
                                + cellhtml('!DungeonConnectFeature DCF_004', cssButtonAnchorImg,_.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_004'})[0].url,cssButtonImg)
                            + '</div>'
                            + '<div style="display: table-row;" >'
                                + cellhtml('!DungeonConnectFeature DCF_005', cssButtonAnchorImg,_.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_005'})[0].url,cssButtonImg)
                                + cellhtml('!DungeonConnectFeature DCF_006', cssButtonAnchorImg,_.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_006'})[0].url,cssButtonImg)
                            + '</div>'
                            + '<div style="display: table-row;" >'
                                + cellhtml('!DungeonConnectFeature DCF_007', cssButtonAnchorImg,_.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_007'})[0].url,cssButtonImg)
                                + cellhtml('!DungeonConnectFeature DCF_008', cssButtonAnchorImg,_.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_008'})[0].url,cssButtonImg)
                            + '</div>'
                        + '</div>'
                        + '<br><a href="!DungeonConnectFillCanel"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>✗-Cancel-Fill-Area</span></a>'
                        + '<br><a href="!DungeonConnectFill"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>◨-Fill-Area</span></a>'
                        + '<br><a href="!DungeonConnectMergePoints"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>◉◉-Merge-Points</span></a>'
                        + '<br><a href="!DungeonConnectConnectPoints"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>◉◉-Connect-Points</span></a>'
                        + '<br><a href="!DungeonConnectBranchPoint"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>◉-Branch-Point</span></a>'
                        + '<br><a href="!DungeonConnectAddPoint"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>▣-Add-Point</span></a>'
                        + '<br><a href="!DungeonConnectAddSegment"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>+-Add-Segment</span></a>'
                        + '<br><a href="!DungeonConnectMore"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>⇓-More Commands</span></a>';
                    }else{  
                        menuText = '/w '  + state.DungeonConnect.who  + ' '
                        + '<br><a href="!DungeonConnectHelp"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>?-Help</span></a>'
                        + '<br><a href="!DungeonConnectClear ?{Are You Sure|N}"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>⊠-Clear-Map</span></a>'
                        + '<br><a href="!DungeonConnectChangeTexture"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>⊞-Change-Texture</span></a>'
                        + '<br><a href="!DungeonConnectMenu"' + cssButtonAnchor + ' ><span' + cssButtonSpan + '>⇓-More Commands</span></a>';
                    }
                    if( true === state.DungeonConnect.drawMode ){
                        menuText += '<br><a href="!DungeonConnectMode" style="border: 1px solid Black; background-color: PaleGreen; color: Black;" ><span style="color: white; font-weight: normal; display: block; width: 150px;" >◯-Draw-Is-<b>ON</b></span>';
                    }else{
                        menuText += '<br><a href="!DungeonConnectMode" style="border: 1px solid DarkGray; background-color: DarkGray; color: white;" ><span style="color: white; font-weight: normal; display: block; width: 150px;" >◯-Draw-Is-<b>OFF</b></span>'; 
                    }
                    sendChat('Main Menu', menuText);
                },
                mainMenuLink = function() {
                    sendChat('Main Menu', '/w "'  
                        + state.DungeonConnect.who 
                        + '" <a href="!DungeonConnectMenu"' + cssButtonAnchor + ' ><span' + cssButtonSpan 
                        + '>Dungeon Draw Menu</span></a>'
                    );
                },
                changeTexture = function() {
                    var installedWalls = [];
                    text = '/w '  + state.DungeonConnect.who  + ' '; installedWalls = [];
                    Object.keys(DungeonConnectWalls.WallTextures).forEach(function(key) { installedWalls.push(key); });
                    _.each(installedWalls, function(eachTextures) {
                        text += '<br><a href="!DungeonConnectSetTexture ' + eachTextures + '"' + cssButtonAnchor2 + ' ><span' + cssButtonSpan + '>' + eachTextures + '</span></a>';
                    });
                    sendChat('Select Texture', text);
                    chatOutput.Input({action: 'main'});
                },
                setTexture = function(input) {
                    var message = input.content.split(' ');
                    state.DungeonConnect.currentWalls = message[1];
                    chatOutput.Input({action: 'menu', text: ''});
                },
                getInput = function(input) {
                    switch(input.action){
                        case 'alert':           alertMessage(input);       break;
                        case 'main':            mainMenuLink();            break;
                        case 'menu':            mainMenu(input);           break;
                        case 'ChangeTexture':   changeTexture();           break;
                        case 'SetTexture':      setTexture(input.message); break;
                        default:                help(input);               break;
                    }
                };
            return {
                Input: getInput
            };
        }()), 
// ~~~> Chat Output <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// ~~~> Features Toggle <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        featuresToggle = (function(){
            var getInput = function(input) {
                    var given = input.message.selected[0]._id, token, pathParts, featurePathArray = [];
                    if( undefined === given ){return; }
                    token = getObj('graphic', given);
                    switch(token.get('name')) {
                        case 'DCF_001':
                            token.set({imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_002'})[0].url, name: 'DCF_002' });
                        break;
                        case 'DCF_002':
                            token.set({imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_001'})[0].url, name: 'DCF_001' });
                        break;
                        case 'DCF_004':
                            token.set({imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_003'})[0].url, name: 'DCF_003' });
                            pathParts = findObjs({layer: 'walls', type: 'path', controlledby: token.get('id') });
                            _.each(pathParts, function(pp) {pp.remove(); });
                            featurePathArray.push({
                                width: 280, height: 140, top: token.get('top'), left: token.get('left'),
                                rotation: token.get('rotation'), fliph: token.get('fliph'), flipv: token.get('flipv'),
                                path: [[35,35],[245,35]],
                                stroke: '#FF0000', strokewidth: 3, forID: token.get('id'), page: token.get('pageid')
                            });
                            utilities.PlaceRotatedFlipPaths(featurePathArray);
                        break;
                        case 'DCF_003':
                            token.set({imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_004'})[0].url, name: 'DCF_004' });
                            pathParts = findObjs({layer: 'walls', type: 'path', controlledby: token.get('id') });
                            _.each(pathParts, function(pp) {pp.remove(); });
                            featurePathArray.push({
                                width: 280, height: 140, top: token.get('top'), left: token.get('left'),
                                rotation: token.get('rotation'), fliph: token.get('fliph'), flipv: token.get('flipv'),
                                path: [[35,35],[70,35],[77,45],[77,105]],
                                stroke: '#FF0000', strokewidth: 3, forID: token.get('id'), page: token.get('pageid')
                            });
                            featurePathArray.push({
                                width: 280,  height: 140, top: token.get('top'), left: token.get('left'),
                                rotation: token.get('rotation'), fliph: token.get('fliph'), flipv: token.get('flipv'),
                                path: [[245,35],[210,35],[203,45],[203,105]],
                                stroke: '#FF0000', strokewidth: 3, forID: token.get('id'), page: token.get('pageid')
                            });
                            utilities.PlaceRotatedFlipPaths(featurePathArray);
                        break;
                        case 'DCF_006':
                            token.set({imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_005'})[0].url, name: 'DCF_005' });
                            pathParts = findObjs({layer: 'walls', type: 'path', controlledby: token.get('id') });
                            _.each(pathParts, function(pp) {pp.remove(); });
                            featurePathArray.push({
                                width: 280, height: 70, top: token.get('top'), left: token.get('left'),
                                rotation: token.get('rotation'), fliph: token.get('fliph'), flipv: token.get('flipv'),
                                path: [[35,35],[245,35]],
                                stroke: '#FF0000', strokewidth: 3, forID: token.get('id'), page: token.get('pageid')
                            });
                            utilities.PlaceRotatedFlipPaths(featurePathArray);
                        break;
                        case 'DCF_005':
                            token.set({imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DCF_006'})[0].url, name: 'DCF_006' });
                            pathParts = findObjs({layer: 'walls', type: 'path', controlledby: token.get('id') });
                            _.each(pathParts, function(pp) {pp.remove(); });
                        break;
                    }
                },
                handleGraphicChange = function(obj) {
                    var pathParts, featurePathArray = [], featureId;
                    if( 'controller' === obj.get('controlledby') || 'feature' === obj.get('controlledby')  ) {
                        if( 'controller' === obj.get('controlledby') ) {
                            featureId = stateFeatureIndexGM[obj.get('id')];
                            if( undefined === featureId ){return; }
                            obj = getObj('graphic', featureId );
                        }
                        switch(obj.get('name')) {
                            case 'DCF_003':
                                pathParts = findObjs({layer: 'walls', type: 'path', controlledby: obj.get('id') });
                                _.each(pathParts, function(pp) {pp.remove(); });
                                featurePathArray.push({
                                    width: 280, height: 140, top: obj.get('top'), left: obj.get('left'),
                                    rotation: obj.get('rotation'), fliph: obj.get('fliph'), flipv: obj.get('flipv'),
                                    path: [[35,35],[245,35]],
                                    stroke: '#FF0000', strokewidth: 3, forID: obj.get('id'), page: obj.get('pageid')
                                });
                                utilities.PlaceRotatedFlipPaths(featurePathArray);
                            break;
                            case 'DCF_004':
                                pathParts = findObjs({layer: 'walls', type: 'path', controlledby: obj.get('id') });
                                _.each(pathParts, function(pp) {pp.remove(); });
                                featurePathArray.push({
                                    width: 280, height: 140, top: obj.get('top'), left: obj.get('left'),
                                    rotation: obj.get('rotation'), fliph: obj.get('fliph'), flipv: obj.get('flipv'),
                                    path: [[35,35],[70,35],[77,45],[77,105]],
                                    stroke: '#FF0000', strokewidth: 3, forID: obj.get('id'), page: obj.get('pageid')
                                });
                                featurePathArray.push({
                                    width: 280,  height: 140,  top: obj.get('top'), left: obj.get('left'),
                                    rotation: obj.get('rotation'), fliph: obj.get('fliph'), flipv: obj.get('flipv'),
                                    path: [[245,35],[210,35],[203,45],[203,105]],
                                    stroke: '#FF0000', strokewidth: 3, forID: obj.get('id'), page: obj.get('pageid')
                                });
                                utilities.PlaceRotatedFlipPaths(featurePathArray);
                            break;
                            case 'DCF_005':
                                pathParts = findObjs({layer: 'walls', type: 'path', controlledby: obj.get('id') });
                                _.each(pathParts, function(pp) {pp.remove(); });
                                featurePathArray.push({
                                    width: 280, height: 70, top: obj.get('top'), left: obj.get('left'),
                                    rotation: obj.get('rotation'), fliph: obj.get('fliph'), flipv: obj.get('flipv'),
                                    path: [[35,35],[245,35]],
                                    stroke: '#FF0000', strokewidth: 3, forID: obj.get('id'), page: obj.get('pageid')
                                });
                                utilities.PlaceRotatedFlipPaths(featurePathArray);
                            break;
                            case 'DCF_006':
                                pathParts = findObjs({layer: 'walls', type: 'path', controlledby: obj.get('id') });
                                _.each(pathParts, function(pp) {pp.remove(); });
                            break;
                        }
                    }
                },
                registerEventHandlers = function(){
                    on('change:graphic',      handleGraphicChange);
                };
            return {
                Input: getInput,
                RegisterEventHandlers: registerEventHandlers
            };
            }()),
// ~~~> Features Toggle <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// ~~~> Features <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        features = (function(){
            var stateAdd = function(feature,control) {
                    state.DungeonConnectFeatures[feature] = {feature: feature, controller: control };
                    stateFeatureIndexGM[control] = feature;
                },
                placeFloor = function(left,top,fId) {
                    createObj('graphic', {
                        pageid: state.DungeonConnect.page || Campaign().get('playerpageid'), 
                        imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_008'})[0].url, 
                        name: 'Floor', left: left, top:top, width: 70, height: 70, layer: 'map', controlledby: fId
                    });
                },
                placeFeature = function(value,leftOffset,rightOffset,w,h) {
                    var center = utilities.GetMapCenterSquare();
                    createObj('graphic', {
                        pageid: state.DungeonConnect.page || Campaign().get('playerpageid'), 
                        imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: value})[0].url, 
                        name: value, left: center.x + leftOffset, top: center.y + rightOffset, width: w, height: h,
                        layer: 'objects', controlledby: 'NEWfeature', represents: utilities.MacrosInstall()
                    }); 
                },
                placeContorller = function(value,offset) {
                    var controller = createObj('graphic', {
                        pageid: state.DungeonConnect.page || Campaign().get('playerpageid'), 
                        imgsrc: 'https://s3.amazonaws.com/files.d20.io/images/11412959/1Ny4Rium7ndU7hBMwalYJQ/thumb.png?1439150042', 
                        name: 'controller', left: value.get('left'), top: value.get('top') + offset, width: 140, height: 70,
                        layer: 'gmlayer', controlledby: 'NEWcontroller', tint_color: '#ffff00', isdrawing: true
                    });
                    stateAdd(value.get('id'),controller.get('id'));
                },
                door = function(action,value) {
                    var newRotation, newLeft, newTop, pairObj,floorParts,fId, newLeft2, newTop2;
                    switch(action){
                        case 'add': placeFeature(value,-35,-35,280,140); break;
                        case 'newadd':
                            value.set('controlledby', 'feature');
                            placeContorller(value,-35);
                            placeFloor(value.get('left') + 35,value.get('top') - 35,value.get('id'));
                            placeFloor(value.get('left') - 35,value.get('top') - 35,value.get('id'));
                            return;
                        case 'update':
                            newRotation = (Math.round(value.get('rotation')/90)*90)%360 + (value.get('rotation')<0 ? 360 : 0);
                            newLeft = Math.floor(value.get('left') / 70) * 70; newTop = (Math.floor(value.get('top') / 70) * 70) + 35;
                            switch(value.get('controlledby')){
                                case 'controller':
                                    if( 90 === newRotation || 270 === newRotation ){newLeft = newLeft + 35; newTop = newTop + 35; }
                                    value.set({left: newLeft, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    fId = stateFeatureIndexGM[value.get('id')]; 
                                    if( 0 === newRotation ) {newTop = newTop + 35; }
                                    if( 180 === newRotation ) {newTop = newTop - 35; }
                                    if( 90 === newRotation ) {newLeft = newLeft - 35; }
                                    if( 270 === newRotation ) {newLeft = newLeft + 35; }
                                    pairObj = getObj('graphic', fId); pairObj.set({left: newLeft, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                break;
                                case 'feature':
                                    newTop = newTop - 35;
                                    value.set({left: newLeft, top: newTop, rotation: newRotation});
                                    pairObj = getObj('graphic', state.DungeonConnectFeatures[value.get('id')].controller);
                                    if( 0 === newRotation ) {
                                        pairObj.set({left: newLeft, top: newTop - 35, rotation: newRotation, tint_color: 'transparent'}); 
                                    }
                                    if( 180 === newRotation ) {
                                        pairObj.set({left: newLeft, top: newTop + 35, rotation: newRotation, tint_color: 'transparent'}); 
                                        newTop = newTop + 35;
                                    }
                                    if( 90 === newRotation ) {
                                        pairObj.set({left: newLeft + 35, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    }
                                    if( 270 === newRotation ) {
                                        pairObj.set({left: newLeft - 35, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    }
                                    fId = value.get('id');
                                break;
                            }
                            floorParts = findObjs({layer: 'map', type: 'graphic', controlledby: fId });
                            _.each(floorParts, function(fp) {fp.remove(); });
                            switch(newRotation){
                                case 0:   newLeft2 = newLeft + 35; newTop2 = newTop - 35; newLeft = newLeft - 35; newTop = newTop - 35; break;
                                case 90:  newLeft2 = newLeft + 35; newTop2 = newTop + 35; newLeft = newLeft + 35; newTop = newTop - 35; break;
                                case 180: newLeft2 = newLeft + 35; newTop2 = newTop; newLeft = newLeft - 35; newTop = newTop; break;
                                case 270: newLeft2 = newLeft - 35; newTop2 = newTop - 35; newLeft = newLeft - 35; newTop = newTop + 35; break;
                            }
                            placeFloor(newLeft,newTop,fId); placeFloor(newLeft2,newTop2,fId);
                        break;
                    }
                },
                bars = function(action,value) {
                    var newRotation, newLeft, newTop, pairObj,floorParts,fId;
                    switch(action){
                        case 'add': placeFeature(value,-35,0,280,70); break;
                        case 'newadd':
                            value.set('controlledby', 'feature'); placeContorller(value,0);
                            placeFloor(value.get('left') + 35,value.get('top'),value.get('id'));
                            placeFloor(value.get('left') - 35,value.get('top'),value.get('id'));
                            return;
                        case 'update':
                            newRotation = (Math.round(value.get('rotation')/90)*90)%360 + (value.get('rotation')<0 ? 360 : 0);
                            newLeft = Math.floor(value.get('left') / 70) * 70; newTop = (Math.floor(value.get('top') / 70) * 70) + 35;
                            switch(value.get('controlledby')){
                                case 'controller':
                                    if( 90 === newRotation || 270 === newRotation ){newLeft = newLeft + 35; newTop = newTop + 35; }
                                    fId = stateFeatureIndexGM[value.get('id')]; value.set({left: newLeft, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    pairObj = getObj('graphic', fId); pairObj.set({left: newLeft, top: newTop, rotation: newRotation});
                                break;
                                case 'feature':
                                    value.set({left: newLeft, top: newTop, rotation: newRotation});
                                    pairObj = getObj('graphic', state.DungeonConnectFeatures[value.get('id')].controller);
                                    pairObj.set({left: newLeft, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    fId = value.get('id');
                                break;
                            }
                            floorParts = findObjs({layer: 'map', type: 'graphic', controlledby: fId });
                            _.each(floorParts, function(fp) {fp.remove(); });
                            switch(newRotation){
                                case 0:
                                case 180:
                                    placeFloor(newLeft + 35,newTop,fId); placeFloor(newLeft - 35,newTop,fId); 
                                break;
                                case 90:
                                case 270: 
                                    placeFloor(newLeft,newTop - 35,fId); placeFloor(newLeft,newTop + 35,fId); 
                                break;
                            }
                        break;
                    }
                },
                secret = function(action,value) {
                    var newRotation, newLeft, newTop, pairObj,floorParts,fId;
                    switch(action){
                        case 'add': placeFeature(value,-35,0,280,70); break;
                        case 'newadd':
                            value.set({controlledby: 'feature', aura1_color: "#FFFF99", aura1_radius: -7}); placeContorller(value,0);
                            placeFloor(value.get('left') + 35,value.get('top'),value.get('id'));
                            placeFloor(value.get('left') - 35,value.get('top'),value.get('id'));
                            return;
                        case 'update':
                            newRotation = (Math.round(value.get('rotation')/90)*90)%360 + (value.get('rotation')<0 ? 360 : 0);
                            newLeft = Math.floor(value.get('left') / 70) * 70; newTop = (Math.floor(value.get('top') / 70) * 70) + 35;
                            switch(value.get('controlledby')){
                                case 'controller':
                                    if( 90 === newRotation || 270 === newRotation ){newLeft = newLeft + 35; newTop = newTop + 35; }
                                    fId = stateFeatureIndexGM[value.get('id')]; value.set({left: newLeft, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    pairObj = getObj('graphic', fId); pairObj.set({left: newLeft, top: newTop, rotation: newRotation, aura1_color: "#FFFF99", aura1_radius: -7});
                                break;
                                case 'feature':
                                    value.set({left: newLeft, top: newTop, rotation: newRotation, aura1_color: "#FFFF99", aura1_radius: -7});
                                    pairObj = getObj('graphic', state.DungeonConnectFeatures[value.get('id')].controller);
                                    pairObj.set({left: newLeft, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    fId = value.get('id');
                                break;
                            }
                            floorParts = findObjs({layer: 'map', type: 'graphic', controlledby: fId });
                            _.each(floorParts, function(fp) {fp.remove(); });
                            switch(newRotation){
                                case 0:
                                case 180:
                                    placeFloor(newLeft + 35,newTop,fId); placeFloor(newLeft - 35,newTop,fId); 
                                break;
                                case 90:
                                case 270: 
                                    placeFloor(newLeft,newTop - 35,fId); placeFloor(newLeft,newTop + 35,fId); 
                                break;
                            }
                        break;
                    }
                },
                stairs = function(action,value) {
                    var center = utilities.GetMapCenterSquare(),controller,newRotation, newLeft, newTop, pairObj, fId;
                    switch(action){
                        case 'add': 
                            createObj('graphic', {
                                pageid: state.DungeonConnect.page || Campaign().get('playerpageid'), 
                                imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: value})[0].url, 
                                name: value, left: center.x - 35, top: center.y - 35, width: 280, height: 280,
                                layer: 'map', controlledby: 'NEWfeature'
                            }); 
                        break;
                        case 'newadd':
                            value.set({controlledby: 'feature'}); 
                            controller = createObj('graphic', {
                                pageid: state.DungeonConnect.page || Campaign().get('playerpageid'), 
                                imgsrc: 'https://s3.amazonaws.com/files.d20.io/images/11412727/Qs-GhkyfHlTIxpzyRBNvYA/thumb.png?1439149342', 
                                name: 'controller', left: value.get('left'), top: value.get('top'), width: 140, height: 140,
                                layer: 'gmlayer', controlledby: 'NEWcontroller', tint_color: '#ffff00', isdrawing: true
                            });
                            stateAdd(value.get('id'),controller.get('id'));
                            toFront(value);
                            return;
                        case 'update':
                            newRotation = (Math.round(value.get('rotation')/90)*90)%360 + (value.get('rotation')<0 ? 360 : 0);
                            newLeft = Math.floor(value.get('left') / 70) * 70; newTop = Math.floor(value.get('top') / 70) * 70;
                            switch(value.get('controlledby')){
                                case 'controller':
                                    if( 90 === newRotation || 270 === newRotation ){newLeft = newLeft; newTop = newTop; }
                                    fId = stateFeatureIndexGM[value.get('id')]; value.set({left: newLeft, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    pairObj = getObj('graphic', fId); pairObj.set({left: newLeft, top: newTop, rotation: newRotation, aura1_color: "#FFFF99", aura1_radius: -7});
                                break;
                                case 'feature':
                                    value.set({left: newLeft, top: newTop, rotation: newRotation, aura1_color: "#FFFF99", aura1_radius: -7});
                                    pairObj = getObj('graphic', state.DungeonConnectFeatures[value.get('id')].controller);
                                    pairObj.set({left: newLeft, top: newTop, rotation: newRotation, tint_color: 'transparent'});
                                    fId = value.get('id');
                                break;
                            }
                            toFront(value);
                        break;
                    }
                },
                add = function(tile) {
                    switch(tile){
                        case 'DCF_001':
                        case 'DCF_002':
                            bars('add',tile);
                        break;
                        case 'DCF_003':
                        case 'DCF_004':
                            door('add',tile);
                        break;    
                        case 'DCF_005':
                        case 'DCF_006':
                            secret('add',tile);
                        break; 
                        case 'DCF_007':
                        case 'DCF_008':
                            stairs('add',tile);
                        break;
                    }
                },
                getInput = function(input) {
                    var action = input.action, tile;
                    switch(action){
                        case 'add':
                            tile = input.message.content.split(' ')[1];
                            add(tile);
                        break;
                    }
                },
                handleGraphicDestroy = function(obj) {
                    var pairObj, pathParts;
                    if( 'NEWcontroller' === obj.get('controlledby') || 'controller' === obj.get('controlledby') ) {
                        if( undefined !== stateFeatureIndexGM[obj.get('id')] ) {
                            pairObj = getObj('graphic', stateFeatureIndexGM[obj.get('id')]);
                            delete state.DungeonConnectFeatures[pairObj.get('id')];
                            pairObj.remove();
                        }
                        delete stateFeatureIndexGM[obj.get('id')];
                    }
                    if ( 'NEWfeature' === obj.get('controlledby') || 'feature' === obj.get('controlledby') ) {
                        if( undefined !== state.DungeonConnectFeatures[obj.get('id')] ) {
                            pairObj = getObj('graphic', state.DungeonConnectFeatures[obj.get('id')].controller);
                            delete stateFeatureIndexGM[pairObj.get('id')];
                            pairObj.remove();
                        }
                        delete state.DungeonConnectFeatures[obj.get('id')];
                    }
                    pathParts = findObjs({layer: 'walls', type: 'path', controlledby: obj.get('id') });
                    _.each(pathParts, function(pp) {pp.remove(); });
                },
                handleGraphicChange = function(obj) {
                    var pairObj;
                    if( 'NEWfeature' === obj.get('controlledby') ) {
                        switch(obj.get('name')){
                            case 'DCF_001':
                            case 'DCF_002':
                                bars('newadd',obj);
                            break;
                            case 'DCF_003':
                            case 'DCF_004':
                                door('newadd',obj);
                            break;
                            case 'DCF_005':
                            case 'DCF_006':
                                secret('newadd',obj);
                            break;
                            case 'DCF_007':
                            case 'DCF_008':
                                stairs('newadd',obj);
                            break;
                        }
                    }
                    if( 'NEWcontroller' === obj.get('controlledby') ) {obj.set('controlledby', 'controller'); return; }
                    if ( 'controller' === obj.get('controlledby') ) {
                            pairObj = getObj('graphic', stateFeatureIndexGM[obj.get('id')]);
                            switch(pairObj.get('name')){
                                case 'DCF_001':
                                case 'DCF_002':
                                    bars('update',obj);
                                break;
                                case 'DCF_003':
                                case 'DCF_004':
                                    door('update',obj);
                                break;
                                case 'DCF_005':
                                case 'DCF_006':
                                    secret('update',obj);
                                break;
                                case 'DCF_007':
                                case 'DCF_008':
                                    stairs('update',obj);
                                break;
                            }   
                    }
                    if ( 'feature' === obj.get('controlledby') ) {
                            switch(obj.get('name')){
                                case 'DCF_001':
                                case 'DCF_002':
                                    bars('update',obj);
                                break;
                                case 'DCF_003':
                                case 'DCF_004':
                                    door('update',obj);
                                break;
                                case 'DCF_005':
                                case 'DCF_006':
                                    secret('update',obj);
                                break;
                            }   
                    }
                },
                registerEventHandlers = function(){
                    on('change:graphic',       handleGraphicChange);
                    on('destroy:graphic',      handleGraphicDestroy);
                };
            return {
                Input: getInput,
                RegisterEventHandlers: registerEventHandlers
            };
            }()),
// ~~~> Features <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// ~~~> FloorDrawing <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        floorDrawing = (function(){
            var wallCheck = function (pixelPos) {
                var mapParts = findObjs({pageid: state.DungeonConnect.page || Campaign().get('playerpageid'),                              
                        type: 'graphic', layer: 'map', left: pixelPos.x, top: pixelPos.y
                    });
                if( 0 === mapParts.length ){return true; }
                return false;
            },
            placeFloor = function(l,t) {
                createObj('graphic', {
                    pageid: state.DungeonConnect.page || Campaign().get('playerpageid'), 
                    imgsrc: _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_008'})[0].url, 
                    name: 'Floor', left: l, top: t, width: 70, height: 70, layer: 'map', controlledby: 'Floor'
                });
            },
            fillArea = function(l,t) {
                    var page, locationList = [{x: l, y: t}],atLocation,mapMinX,mapMinY,mapMaxX,mapMaxY;
                    page = findObjs({id: state.DungeonConnect.page || Campaign().get('playerpageid') });
                    mapMinX = 0;
                    mapMinY = 0;
                    mapMaxX = page[0].get('width') * 70;
                    mapMaxY = page[0].get('height') * 70;
                    while(locationList.length) {
                        atLocation = locationList.pop();
                        if( wallCheck(atLocation) 
                            && ((atLocation.x - 70) > mapMinX)
                            && ((atLocation.x + 70) < mapMaxX)
                            && ((atLocation.y - 70) > mapMinY)
                            && ((atLocation.y + 70) < mapMaxY)) 
                        {
                            placeFloor(atLocation.x,atLocation.y);
                            locationList.push({x: atLocation.x + 70, y: atLocation.y});
                            locationList.push({x: atLocation.x - 70, y: atLocation.y});
                            locationList.push({x: atLocation.x, y: atLocation.y + 70});
                            locationList.push({x: atLocation.x, y: atLocation.y - 70});
                        }
                    }
                },
                handleGraphicDestroy = function(obj) {
                    if( 'FillBucket' === obj.get('controlledby') ) {
                        fillArea(obj.get('left'),obj.get('top'));
                    }
                },
                registerEventHandlers = function(){
                    on('destroy:graphic',      handleGraphicDestroy);
                };
            return {
                RegisterEventHandlers: registerEventHandlers
            };
            }()),
// ~~~> FloorDrawing <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// ~~~> NodeDrawing <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        nodeDrawing = (function(){
            var nodeCenter = function(node,nodeValue) {
                    var missSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_000'})[0],
                        findSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, value: nodeValue})[0],
                        tileSrc;
                    if( undefined === findSrc ) {
                        tileSrc = missSrc;
                    }else{
                        tileSrc = findSrc;
                    }
                    createObj('graphic', {
                            pageid: node.get('pageid'), imgsrc: tileSrc.url, name: tileSrc.key,
                            left: node.get('left'), top: node.get('top'), width: 70, height: 70,
                            layer: 'map', controlledby: node.get('id'), rotation: tileSrc.degree,
                            fliph: tileSrc.flip
                    });
                },
                wallMaker = function(xOffset,yOffset,tileSrc,id,page,rot){
                    createObj('graphic', {
                            pageid: page, imgsrc: tileSrc, name: 'nodeborder',
                            left: xOffset, top: yOffset, width: 70, height: 70,
                            layer: 'map', controlledby: id, rotation: rot
                    });
                    
                },
                nodeBorder = function(bits,xOffset,yOffset,id,page,rotOffset) {
                    var tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_000'})[0].url;
                    switch (bits){
                        case '100': 
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_003'})[0].url;
                            wallMaker(xOffset,yOffset,tileSrc,id,page,90 + rotOffset);
                        break;
                        case '010': 
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_001'})[0].url;
                            wallMaker(xOffset,yOffset,tileSrc,id,page,rotOffset);
                        break;
                        case '001': 
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_003'})[0].url;
                            wallMaker(xOffset,yOffset,tileSrc,id,page,rotOffset);
                        break;
                        case '110': 
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_004'})[0].url;
                            wallMaker(xOffset,yOffset,tileSrc,id,page,rotOffset);
                        break;
                        case '011': 
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_005'})[0].url;
                            wallMaker(xOffset,yOffset,tileSrc,id,page,rotOffset);
                        break;
                        case '101': 
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_006'})[0].url;
                            wallMaker(xOffset,yOffset,tileSrc,id,page,rotOffset);
                        break;
                        case '111':
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_007'})[0].url;
                            wallMaker(xOffset,yOffset,tileSrc,id,page,rotOffset);
                        break;
                    }
                },
          
                nodeBranchMaker = function(nodeId) {
                    var pathList = stateIndexX[nodeId],p,nodeValue = 0,aId,bId,wallParts,bits,direction,node;
                    
                    _.each(pathList, function(pathId) {
                        p = state.DungeonConnectPaths[pathId];
                        if( undefined !== p) {
                            aId = p.aNodeId;
                            bId = p.bNodeId;
                            if( aId === nodeId && 256 !== parseInt(p.aNodeAngle) ){
                                nodeValue = nodeValue + parseInt(p.aNodeAngle);
                            }
                            if( bId === nodeId && 256 !== parseInt(p.bNodeAngle) ){
                                nodeValue = nodeValue + parseInt(p.bNodeAngle);
                            }
                        }
                    });
                    
                    wallParts = findObjs({layer: 'map', type: 'graphic', controlledby: nodeId });
                    _.each(wallParts, function(wp) {wp.remove(); });
                    node = getObj('graphic', nodeId);
                    if( 256 === nodeValue || 0 === nodeValue || undefined === node ){return; }
                    
                    bits = '00000000' + parseInt(nodeValue, 10).toString(2);
                    bits = bits.substr(bits.length - 8);
                    
                    direction = bits.substring(0,3);
                    nodeBorder(direction,node.get('left'),node.get('top') - 70,nodeId,node.get('pageid'),0);
                    direction = bits.substring(2,5);
                    nodeBorder(direction,node.get('left') + 70,node.get('top'),nodeId,node.get('pageid'),90);
                    direction = bits.substring(4,7);
                    nodeBorder(direction,node.get('left'),node.get('top') + 70,nodeId,node.get('pageid'),180);
                    direction = bits.substring(6,8) + bits.substring(0,1);
                    nodeBorder(direction,node.get('left') - 70,node.get('top'),nodeId,node.get('pageid'),270);
                    nodeCenter(node,nodeValue);
                },
            
                getInput = function() {
                    var a,wallPart;
                    _.each(nodeUpdated, function(nodeId) {
                        a = getObj('graphic',nodeId);
                        wallPart = findObjs({type: 'graphic', controlledby: nodeId });
                        _.each(wallPart, function(wp) {wp.remove(); });
                        if(undefined !== a){
                            _.debounce(nodeBranchMaker(nodeId), 100);
                        }
                    });
                    nodeUpdated = [];
                },
                handleGraphicDestroy = function(obj) {
                    var wallParts = findObjs({layer: 'map', type: 'graphic', controlledby: obj.get('id') });
                    _.each(wallParts, function(wp) {wp.remove(); });
                },
                pathDestroy = function(obj) {
                    var nodeId = obj.get('id');
                
                    if(undefined !== nodeId){
                        _.debounce(nodeBranchMaker(nodeId), 100);
                    }
                },
                registerEventHandlers = function(){
                    on('destroy:graphic',      handleGraphicDestroy);
                };
        return {
            RegisterEventHandlers: registerEventHandlers,
            Input: getInput,
            PathDestroy: pathDestroy
        };
        }()),
// ~~~> NodeDrawing <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// ~~~> WallDrawing <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        wallDrawing = (function(){
            var p,
                createWall = function(pathId) {
                    var pathData = state.DungeonConnectPaths[pathId],x1,y1,x2,y2,tileSrc;
                    if( undefined === pathData) {return; }
                    switch(pathData.aNodeAngle){
                        case 4:  
                        case 64: 
                            x1 = Math.min(pathData.aNodeLeft, pathData.bNodeLeft);
                            y1 = Math.min(pathData.aNodeTop, pathData.bNodeTop) + 140;
                            x2 = Math.max(pathData.aNodeLeft, pathData.bNodeLeft);
                            y2 = Math.max(pathData.aNodeTop, pathData.bNodeTop) - 70;
                            if( (y2 - y1) < 70 ) {return; }
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_001'})[0].url;
                            do {
                                utilities.DeferredWall(x1,y1,tileSrc,pathId,pathData.page,0); 
                                y1 = y1 + 70;
                            }
                            while (y1 < y2);
                        break;
                        case 1:  
                        case 16: 
                            x1 = Math.min(pathData.aNodeLeft, pathData.bNodeLeft) + 140;
                            y1 = Math.min(pathData.aNodeTop, pathData.bNodeTop);
                            x2 = Math.max(pathData.aNodeLeft, pathData.bNodeLeft) - 70;
                            y2 = Math.max(pathData.aNodeTop, pathData.bNodeTop);
                            if( (x2 - x1) < 70 ) {return; }
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_001'})[0].url;
                            do {
                                utilities.DeferredWall(x1,y1,tileSrc,pathId,pathData.page,90); 
                                x1 = x1 + 70;
                            }
                            while (x1 < x2);
                        break;
                        case 8:  
                        case 128: 
                            x1 = Math.min(pathData.aNodeLeft, pathData.bNodeLeft) + 140;
                            y1 = Math.min(pathData.aNodeTop, pathData.bNodeTop) + 140;
                            x2 = Math.max(pathData.aNodeLeft, pathData.bNodeLeft) - 70;
                            y2 = Math.max(pathData.aNodeTop, pathData.bNodeTop) - 70;
                            if( (x2 - x1) < 70 ) {
                                if( -70 === (x2 - x1) ){
                                    tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                                    utilities.DeferredWall(x1 - 70,y1 - 70,tileSrc,pathId,pathData.page,90);
                                    return; 
                                }
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                                utilities.DeferredWall(x1 - 70,y1 - 70,tileSrc,pathId,pathData.page,90);
                                utilities.DeferredWall(x1,y1,tileSrc,pathId,pathData.page,90);
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_003'})[0].url;
                                utilities.DeferredWall(x1,y1 - 70,tileSrc,pathId,pathData.page,90);
                                utilities.DeferredWall(x1 - 70,y1,tileSrc,pathId,pathData.page,270);
                                return; 
                            }
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                            utilities.DeferredWall(x1 - 70,y1 - 70,tileSrc,pathId,pathData.page,90);
                            do {
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                                utilities.DeferredWall(x1,y1,tileSrc,pathId,pathData.page,90);
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_003'})[0].url;
                                utilities.DeferredWall(x1,y1 - 70,tileSrc,pathId,pathData.page,90);
                                utilities.DeferredWall(x1 - 70,y1,tileSrc,pathId,pathData.page,270);
                                x1 = x1 + 70;
                                y1 = y1 + 70;
                            }
                            while (x1 < x2);
                                utilities.DeferredWall(x1,y1 - 70,tileSrc,pathId,pathData.page,90);
                                utilities.DeferredWall(x1 - 70,y1,tileSrc,pathId,pathData.page,270);
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                                utilities.DeferredWall(x1,y1,tileSrc,pathId,pathData.page,90);
                        break;
                        case 2:  
                        case 32: 
                            x1 = Math.max(pathData.aNodeLeft, pathData.bNodeLeft) - 140;
                            y1 = Math.min(pathData.aNodeTop, pathData.bNodeTop) + 140;
                            x2 = Math.min(pathData.aNodeLeft, pathData.bNodeLeft) + 70;
                            y2 = Math.max(pathData.aNodeTop, pathData.bNodeTop) - 70;
                            if( (x1 - x2) < 70 ) {
                                if( -70 === (x1 - x2) ){
                                    tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                                    utilities.DeferredWall(x1 + 70,y1 - 70,tileSrc,pathId,pathData.page,0);
                                    return; 
                                }
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                                utilities.DeferredWall(x1,y1,tileSrc,pathId,pathData.page,0);
                                utilities.DeferredWall(x1 + 70,y1 - 70,tileSrc,pathId,pathData.page,0);
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_003'})[0].url;
                                utilities.DeferredWall(x1,y1 - 70,tileSrc,pathId,pathData.page,0);
                                utilities.DeferredWall(x1 + 70,y1,tileSrc,pathId,pathData.page,180);
                                return; 
                            }
                            tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                            utilities.DeferredWall(x1 + 70,y1 - 70,tileSrc,pathId,pathData.page,0);
                            do {
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                                utilities.DeferredWall(x1,y1,tileSrc,pathId,pathData.page,0);
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_003'})[0].url;
                                utilities.DeferredWall(x1,y1 - 70,tileSrc,pathId,pathData.page,0);
                                utilities.DeferredWall(x1 + 70,y1,tileSrc,pathId,pathData.page,180);
                                x1 = x1 - 70;
                                y1 = y1 + 70;
                            }
                            while (y1 < y2);
                                utilities.DeferredWall(x1,y1 - 70,tileSrc,pathId,pathData.page,0);
                                utilities.DeferredWall(x1 + 70,y1,tileSrc,pathId,pathData.page,180);
                                tileSrc = _.where(wallTextures, {pack: state.DungeonConnect.currentWalls, key: 'DC_002'})[0].url;
                                utilities.DeferredWall(x1,y1,tileSrc,pathId,pathData.page,0);
                        break;
                    }
                },
                getInput = function() {
                    var wallPart;
                    _.each(pathUpdated, function(pathId) {
                        p = getObj('path',pathId);
                        wallPart = findObjs({layer: 'map', type: 'graphic', controlledby: pathId });
                        _.each(wallPart, function(wp) {wp.remove(); });
                        if(undefined !== p){
                            _.debounce(createWall(pathId), 100);
                        }
                    });
                    pathUpdated = [];
                },
                handlePathDestroy = function(obj) {
                    var wallPart = findObjs({layer: 'map', type: 'graphic', controlledby: obj.get('id') });
                    _.each(wallPart, function(wp) {wp.remove(); });
                },
                registerEventHandlers = function(){
                    on('destroy:path',      handlePathDestroy);
                };
            return {
                RegisterEventHandlers: registerEventHandlers,
                Input: getInput
            };
        }()),
// ~~~> WallDrawing <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// ~~~> Path Drawing <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  
        pathDrawing = (function(){
            var post = 'https://s3.amazonaws.com/files.d20.io/images/11412286/uflq2DUCrTk89QlWdbjP_Q/thumb.png?1439148046',
                middle = 'https://s3.amazonaws.com/files.d20.io/images/11412329/7NnEepToGq58ZASG0gBYTw/thumb.png?1439148185',
                controls = 'gmlayer',
                visbleLines = 'objects',
                pathVisibleGood = 'transparent',
                pathVisibleBad = '#ff0000',
                postGood = 'transparent',
                postBad = '#ff0000',
                
                postOverlapChecker = function(obj) {
                    var dotOverlap = filterObjs(function(dot) {    
                        if( (obj.get('layer') === dot.get('layer') && obj.get('pageid') === dot.get('pageid'))
                            && (obj.get('left') >= dot.get('left') - 70 && obj.get('left') <= dot.get('left') + 70)
                            && (obj.get('top') >= dot.get('top') - 70 && obj.get('top') <= dot.get('top') + 70)
                            && 'DungeonConnectPost' === dot.get('controlledby') && 'gmlayer' === dot.get('layer')) 
                        {return true; }else{return false; }
                    });
                    
                    if( 1 !== dotOverlap.length ) {obj.set('tint_color', postBad);
                    }else{obj.set('tint_color', postGood); }
                },
                postOverlapCheck = function(obj) {
                    var allPostOnPage = findObjs({pageid: obj.get('pageid'),                              
                        type: 'graphic', controlledby: 'DungeonConnectPost',
                        layer: 'gmlayer'});
                        
                    _.each(allPostOnPage, function(postFound) {
                        postOverlapChecker(postFound);
                    });
                },
                forceProperPlacementPost = function(obj) {
                    obj.set({rotation: 0, flipv: false, fliph: false, width: 70, height: 70,
                        top: (Math.floor(obj.get('top') / 70) * 70) + 35,
                        left: (Math.floor(obj.get('left') / 70) * 70) + 35
                    });
                },
                
                createSegmentPath = function(a, b, m) {
                    var segmentStateValues, pathValues, p, g, crossLines,existingPaths,crosses = false,existingPathData;
                    if( undefined !== stateIndexABBA[a.get('id') + ':' + b.get('id')] 
                        ||  undefined !== stateIndexABBA[b.get('id') + ':' + a.get('id')] 
                        || (a.get('id') === b.get('id')) ){
                        return; 
                    }
                    existingPaths = findObjs({                              
                        pageid: state.DungeonConnect.page,                              
                        type: 'path',
                        layer: 'walls',
                        controlledby: 'DungeonConnectPath'
                    });
                    _.each(existingPaths, function(eachExiting) {
                        existingPathData = state.DungeonConnectPaths[eachExiting.get('id')];
                        if( undefined !== existingPathData ){
                            crossLines = utilities.Intersects(
                                a.get('left'),
                                a.get('top'),
                                b.get('left'),
                                b.get('top'),
                                existingPathData.aNodeLeft,
                                existingPathData.aNodeTop,
                                existingPathData.bNodeLeft,
                                existingPathData.bNodeTop
                            ); 
                            if(crossLines === true ){
                                crosses = true;
                            }
                        }
                    });
                    segmentStateValues = {
                        id: '',
                        left: (a.get('left') + b.get('left')) / 2,
                        top: (a.get('top') + b.get('top')) / 2,
                        aNodeId: a.get('id'),
                        aNodeLeft: a.get('left'), 
                        aNodeTop: a.get('top'), 
                        bNodeId: b.get('id'),
                        bNodeLeft: b.get('left'), 
                        bNodeTop: b.get('top'), 
                        mNodeId: m.get('id'),
                        mNodeLeft: m.get('left'), 
                        mNodeTop: m.get('top'),
                        clone: '',
                        width: Math.abs(a.get('left') - b.get('left')),
                        height: Math.abs(a.get('top') - b.get('top')),
                        aNodeAngle: utilities.BitDirection(b.get('left'),b.get('top'),a.get('left'),a.get('top')), 
                        bNodeAngle: utilities.BitDirection(a.get('left'),a.get('top'),b.get('left'),b.get('top')),
                        page: a.get('pageid'),
                        intersects: crosses
                    };
                    if( true === crosses || 'transparent' !== a.get('tint_color') || 'transparent' !== b.get('tint_color') ) {
                        segmentStateValues.aNodeAngle = 256;
                        segmentStateValues.bNodeAngle = 256;
                    }
                    pathValues = {
                        pageid: state.DungeonConnect.page,
                        stroke: '#000000', 
                        stroke_width: 1,
                        width: segmentStateValues.width, 
                        height: segmentStateValues.height,
                        left: segmentStateValues.left, 
                        top: segmentStateValues.top,
                        path: '[["M", ' 
                            + (a.get('left') - Math.min(a.get('left'), b.get('left'))) + ', ' 
                            + (a.get('top') - Math.min(a.get('top'), b.get('top'))) + '],["L", ' 
                            + (b.get('left') - Math.min(a.get('left'), b.get('left'))) + ', ' 
                            + (b.get('top') - Math.min(a.get('top'), b.get('top'))) + ']]',
                        layer: 'walls',
                        controlledby: 'NEWDungeonConnectPath'
                    };
                    p = createObj('path', pathValues);
                    segmentStateValues.id = p.get('id');
                    pathValues.stroke = segmentStateValues.aNodeAngle  === 256 || crosses === true? pathVisibleBad : pathVisibleGood;
                    pathValues.stroke_width = 3;
                    pathValues.layer = visbleLines;
                    g = createObj('path', pathValues);
                    segmentStateValues.clone = g.get('id');
                    state.DungeonConnectPaths[p.get('id')] = segmentStateValues;
                    if( undefined === stateIndexX[a.get('id')] ){stateIndexX[a.get('id')] = []; }
                    stateIndexX[a.get('id')].push(p.get('id'));
                    if( undefined === stateIndexX[b.get('id')] ){stateIndexX[b.get('id')] = []; }
                    stateIndexABBA[b.get('id') + ':' + a.get('id')] = p.get('id');
                    stateIndexABBA[a.get('id') + ':' + b.get('id')] = p.get('id');
                    stateIndexX[b.get('id')].push(p.get('id'));
                    stateIndexM[m.get('id')] = p.get('id');
                    stateIndexP[p.get('id')] = p.get('id');
                    stateIndexG[g.get('id')] = p.get('id');
                    return segmentStateValues;
                },
                updateSegment = function(obj) {
                    var pathIds = stateIndexX[obj.get('id')], a, b, m, p, g, l, t, pathReturned;
                    _.each(pathIds, function(pathId) {
                        p = getObj('path', pathId);
                        a = getObj('graphic', state.DungeonConnectPaths[pathId].aNodeId);
                        b = getObj('graphic', state.DungeonConnectPaths[pathId].bNodeId);
                        m = getObj('graphic', state.DungeonConnectPaths[pathId].mNodeId);
                        g = getObj('path', state.DungeonConnectPaths[pathId].clone);
                        if( undefined !== a && undefined !== b && undefined !== m ){
                            l = (a.get('left') + b.get('left')) / 2;
                            t = (a.get('top') + b.get('top')) / 2;
                            delete stateIndexABBA[a.get('id') + ':' + b.get('id')];
                            delete stateIndexABBA[b.get('id') + ':' + a.get('id')];
                            delete state.DungeonConnectPaths[pathId];
                            stateIndexX[a.get('id')] = _.without(stateIndexX[a.get('id')], pathId);
                            stateIndexX[b.get('id')] = _.without(stateIndexX[b.get('id')], pathId);
                            m.set({left: l, top: t});   delete stateIndexM[m.get('id')];
                            p.set('controlledby', 'removed'); p.remove(); delete stateIndexP[p.get('id')];
                            g.set('controlledby', 'removed'); g.remove(); delete stateIndexG[g.get('id')]; 
                            _.debounce(pathReturned = createSegmentPath(a, b, m), 100);
                            pathUpdated.push(pathReturned.id);
                            nodeUpdated.push(pathReturned.aNodeId);
                            nodeUpdated.push(pathReturned.bNodeId);
                        }
                    });
                },
                connectPoints = function(message) {
                    var a, b, m, pathReturned,
                        selected = _.chain(message.selected).map(function(s){
                            return getObj('graphic',s._id);}).reject(_.isUndefined)
                                .filter(function(o){
                                    return /(NEWDungeonConnectPost|DungeonConnectPost)/.test(o.get('controlledby'));
                                })
                        .value(),
                        postValues = {
                            left: 35, top: 35,
                            width: 70, height: 70,
                            layer: controls, pageid: state.DungeonConnect.page || Campaign().get('playerpageid'),
                            imgsrc: post, controlledby: 'NEWDungeonConnectPost',
                            tint_color: postGood, isdrawing: true
                        };
                    if( 1 >= selected.length ) {
                        chatOutput.Input({
                            action: 'alert',
                            type: 'Caution',
                            text: '<b>Caution.</b> You must select a <b>Post</b> to add a point to.'
                        });
                        return;
                    }
                    a = getObj('graphic', selected[0].get('_id'));
                    b = getObj('graphic', selected[1].get('_id'));
                    postValues.imgsrc = middle;
                    postValues.controlledby = 'NewMiddlePost';
                    postValues.left = (a.get('left') + b.get('left')) / 2;
                    postValues.top = (a.get('top') + b.get('top')) / 2;
                    m = createObj('graphic', postValues);
                    _.debounce(pathReturned = createSegmentPath(a, b, m), 500);
                    pathUpdated.push(pathReturned.id);
                    nodeUpdated.push(pathReturned.aNodeId);
                    nodeUpdated.push(pathReturned.bNodeId);
                },
                branchPoint = function(message) {
                    var pathId,aNode,bNode,x,xy = utilities.GetMapCenterSquare(),m,c,pathReturned,
                        postValues = {
                            left: 35, top: 35,
                            width: 70, height: 70,
                            layer: controls, pageid: state.DungeonConnect.page || Campaign().get('playerpageid'),
                            imgsrc: post, controlledby: 'NEWDungeonConnectPost',
                            tint_color: postGood, isdrawing: true
                        },
                        selected = _.chain(message.selected).map(function(s){
                            return getObj('graphic',s._id);}).reject(_.isUndefined)
                                .filter(function(o){
                                    return /(NEWDungeonConnectPost|DungeonConnectPost)/.test(o.get('controlledby'));
                                })
                        .value();
                    if( 1 > selected ) {
                        chatOutput.Input({
                            action: 'alert',
                            type: 'Caution',
                            text: '<b>Caution.</b> You must select a <b>Post</b> to add a point to.'
                        });
                        return;
                    }
                    if(  stateIndexX[selected[0].get('id')].length >= 8 ) {return; }
                    pathId = stateIndexX[selected[0].get('id')][0];
                    aNode = state.DungeonConnectPaths[pathId].aNodeId;
                    bNode = state.DungeonConnectPaths[pathId].bNodeId;
                    if( aNode === selected[0].get('_id') ) {
                        x = getObj('graphic', aNode);
                    }else{
                        x = getObj('graphic', bNode);
                    }
                    postValues.left = x.get('left') < xy.x ? x.get('left') + 280 : x.get('left') - 280;
                    postValues.top = x.get('top') < xy.y ? x.get('top') + 210 : x.get('top') - 210;
                    c = createObj('graphic', postValues);
                    postValues.imgsrc = middle;
                    postValues.left = (postValues.left + x.get('left')) / 2;
                    postValues.top = (postValues.top + x.get('top')) / 2;
                    postValues.controlledby = 'NewMiddlePost';
                    m = createObj('graphic', postValues);
                    _.debounce(pathReturned = createSegmentPath(x, c, m), 500);
                    pathUpdated.push(pathReturned.id);
                    nodeUpdated.push(pathReturned.aNodeId);
                    nodeUpdated.push(pathReturned.bNodeId);
                },
                addPoint = function(message) {
                    var pathId,p,a,b,m,g,c,cx,cy,m1,m2,pathReturned,
                        selected = _.chain(message.selected).map(function(s){
                            return getObj('graphic',s._id);}).reject(_.isUndefined)
                                .filter(function(o){
                                    return /(MiddlePost)/.test(o.get('controlledby'));
                                })
                        .value(),
                        postValues = {
                            left: 35, top: 35, width: 70, height: 70,
                            layer: controls, pageid: state.DungeonConnect.page || Campaign().get('playerpageid'),
                            imgsrc: post, controlledby: 'NEWDungeonConnectPost',
                            tint_color: postGood, isdrawing: true
                        };
                    if( 1 > selected ) {
                        chatOutput.Input({
                            action: 'alert',
                            type: 'Caution',
                            text: '<b>Caution.</b> You must select a <b>Path</b> to add a point to.'
                        });
                        return;
                    }
                    pathId = stateIndexM[selected[0].get('id')];
                    p = getObj('path', pathId);
                    a = getObj('graphic', state.DungeonConnectPaths[pathId].aNodeId);
                    b = getObj('graphic', state.DungeonConnectPaths[pathId].bNodeId);
                    m = getObj('graphic', state.DungeonConnectPaths[pathId].mNodeId);
                    g = getObj('path', state.DungeonConnectPaths[pathId].clone);
                    if( undefined !== a && undefined !== b && undefined !== m ){
                        cx = (Math.floor(((a.get('left') + b.get('left')) / 2) / 70) * 70) + 35;
                        cy = (Math.floor(((a.get('top') + b.get('top')) / 2) / 70) * 70) + 35;
                        postValues.left = cx; 
                        postValues.top = cy;
                        c = createObj('graphic', postValues);
                        postValues.imgsrc = middle;
                        postValues.left = (cx + a.get('left')) / 2;
                        postValues.top = (cy + a.get('top')) / 2;
                        postValues.controlledby = 'NewMiddlePost';
                        m1 = createObj('graphic', postValues);
                        postValues.left = (cx + b.get('left')) / 2;
                        postValues.top = (cy + b.get('top')) / 2;
                        m2 = createObj('graphic', postValues);
                        delete state.DungeonConnectPaths[p.get('id')];
                        stateIndexX[a.get('id')] = _.without(stateIndexX[a.get('id')], pathId);
                        stateIndexX[b.get('id')] = _.without(stateIndexX[b.get('id')], pathId);
                        p.set('controlledby', 'removed'); p.remove(); delete stateIndexP[p.get('id')];
                        g.set('controlledby', 'removed'); g.remove(); delete stateIndexG[g.get('id')]; 
                        m.set('controlledby', 'removed'); m.remove(); delete stateIndexM[m.get('id')];
                        _.debounce(pathReturned = createSegmentPath(a, c, m1), 500);
                        pathUpdated.push(pathReturned.id);
                        nodeUpdated.push(pathReturned.aNodeId);
                        nodeUpdated.push(pathReturned.bNodeId);
                        _.debounce(pathReturned = createSegmentPath(b, c, m2), 500);
                        pathUpdated.push(pathReturned.id);
                        nodeUpdated.push(pathReturned.aNodeId);
                        nodeUpdated.push(pathReturned.bNodeId);
                    }
                },
                addSegment = function() {
                    var mapCenterSquare = utilities.GetMapCenterSquare(), a, b, m, postValues = {
                        left: mapCenterSquare.x - 140, top: mapCenterSquare.y - 140, width: 70, height: 70,
                        layer: controls, pageid: state.DungeonConnect.page || Campaign().get('playerpageid'),
                        imgsrc: post, controlledby: 'NEWDungeonConnectPost', tint_color: postGood, isdrawing: true
                    }, pathReturned;
                    a = createObj('graphic', postValues);
                    postValues.left = mapCenterSquare.x + 140; postValues.top = mapCenterSquare.y + 210;
                    b = createObj('graphic', postValues);
                    postValues.imgsrc = middle;
                    postValues.left = ((mapCenterSquare.x - 140) + (mapCenterSquare.x + 140 )) / 2;
                    postValues.top = ((mapCenterSquare.y - 140) + (mapCenterSquare.y + 210 )) / 2;
                    postValues.controlledby = 'NewMiddlePost';
                    m = createObj('graphic', postValues);
                    _.debounce(pathReturned = createSegmentPath(a, b, m), 500);
                    pathUpdated.push(pathReturned.id);
                    nodeUpdated.push(pathReturned.aNodeId);
                    nodeUpdated.push(pathReturned.bNodeId);
                },
                mergePoints = function(message)  {
                    var aList,bList,k,d,dId,pathIds,aId,bId,m,b,deleteList,ad,bd,p,g,l,t,common = false,pathReturned,
                        selected = _.chain(message.selected).map(function(s){
                            return getObj('graphic',s._id);}).reject(_.isUndefined)
                                .filter(function(o){
                                    return /(NEWDungeonConnectPost|DungeonConnectPost)/.test(o.get('controlledby'));
                                })
                        .value();
                    if( 1 >= selected.length ) {
                        chatOutput.Input({
                            action: 'alert',
                            type: 'Caution',
                            text: '<b>Caution.</b> You must select a <b>Post</b> to add a point to.'
                        });
                        return;
                    }
                    aList = stateIndexX[selected[0].get('id')];
                    bList = stateIndexX[selected[1].get('id')];
                    _.each(aList, function(pathId) {
                        aId = state.DungeonConnectPaths[pathId].aNodeId; 
                        bId = state.DungeonConnectPaths[pathId].bNodeId;
                        if( (aId === selected[0].get('id') && bId === selected[1].get('id')) 
                            || (bId === selected[0].get('id') && aId === selected[1].get('id')) ) 
                        {common = true;   
                        }
                    });
                    if( true === common ){
                        chatOutput.Input({
                            action: 'alert',
                            type: 'Caution',
                            text: '<b>Caution.</b> You cannot merge node that make up the same path.'
                        });
                        return;    
                    }
                    if( aList.length > bList.length ){
                        k = getObj('graphic', selected[0].get('_id'));
                        d = getObj('graphic', selected[1].get('_id'));
                        dId = d.get('_id');
                        pathIds = bList; 
                    }else{
                        k = getObj('graphic', selected[1].get('_id'));
                        d = getObj('graphic', selected[0].get('_id'));
                        dId = d.get('_id');
                        pathIds = aList;
                    }
                    _.each(pathIds, function(pathId) {
                        aId = state.DungeonConnectPaths[pathId].aNodeId; 
                        bId = state.DungeonConnectPaths[pathId].bNodeId;
                        m = getObj('graphic', state.DungeonConnectPaths[pathId].mNodeId);
                        delete stateIndexM[m.get('id')];
                        if( dId === aId ){
                            b = getObj('graphic', state.DungeonConnectPaths[pathId].bNodeId);
                        }else{
                            b = getObj('graphic', state.DungeonConnectPaths[pathId].aNodeId);
                        }
                        l = (k.get('left') + b.get('left')) / 2;
                        t = (k.get('top') + b.get('top')) / 2;
                        m.set({left: l, top: t});
                        _.debounce(pathReturned = createSegmentPath(k, b, m), 100);
                        pathUpdated.push(pathReturned.id);
                        nodeUpdated.push(pathReturned.aNodeId);
                        nodeUpdated.push(pathReturned.bNodeId);
                    });
                    deleteList = stateIndexX[dId];
                    _.each(deleteList, function(pathId) {
                        ad = state.DungeonConnectPaths[pathId].aNodeId;
                        if( undefined !== ad ) {
                            stateIndexX[ad] = _.without(stateIndexX[ad], pathId);
                        }
                        bd = state.DungeonConnectPaths[pathId].bNodeId;
                        if( undefined !== bd ) {
                            stateIndexX[bd] = _.without(stateIndexX[bd], pathId);
                        }
                        p = getObj('path', state.DungeonConnectPaths[pathId].id);
                        g = getObj('path', state.DungeonConnectPaths[pathId].clone);
                        p.set('controlledby', 'removed'); p.remove(); delete stateIndexP[p.get('id')];
                        g.set('controlledby', 'removed'); g.remove(); delete stateIndexG[g.get('id')];
                        delete state.DungeonConnectPaths[pathId];
                    });
                    d.set('controlledby','removed'); d.remove(); 
                },
                getInput = function(input) {
                    switch(input.action){
                        case 'AddSegment':     addSegment();                   break;
                        case 'AddPoint':       addPoint(input.message);        break;
                        case 'BranchPoint':    branchPoint(input.message);     break;
                        case 'ConnectPoints':  connectPoints(input.message);   break;
                        case 'MergePoints':    mergePoints(input.message);     break;
                    }
                    pathUpdated = _.uniq(pathUpdated);
                    nodeUpdated = _.uniq(nodeUpdated);
                    setTimeout(function() {wallDrawing.Input(); }, 200);
                    setTimeout(function() {nodeDrawing.Input(); }, 200);
                },
                middlePostMove = function(obj) {
                    var pathId = stateIndexM[obj.get('id')],a,b,leftMove,topMove,oldLeft,oldTop,deltaLeft,deltaTop;
                    obj.set({width: 70, height: 70, rotation:0});
                    oldLeft = state.DungeonConnectPaths[pathId].mNodeLeft;
                    oldTop = state.DungeonConnectPaths[pathId].mNodeTop;
                    deltaLeft = (oldLeft - obj.get('left'));
                    deltaTop = (oldTop - obj.get('top'));
                    if( deltaLeft > 0 ) {
                        deltaLeft = Math.ceil(deltaLeft/10) * 10;
                    }else{
                        deltaLeft = Math.floor(deltaLeft/10) * 10;
                    }
                    if( deltaTop > 0 ) {
                        deltaTop = Math.ceil(deltaTop /10) * 10;
                    }else{
                        deltaTop  = Math.floor(deltaTop /10) * 10;
                    }
                    a = getObj('graphic', state.DungeonConnectPaths[pathId].aNodeId);
                    b = getObj('graphic', state.DungeonConnectPaths[pathId].bNodeId);
                    leftMove = a.get('left') - deltaLeft;
                    topMove = a.get('top') - deltaTop;
                    a.set('left', leftMove);    
                    a.set('top', topMove);   
                    handleGraphicChange(a);
                    leftMove = b.get('left') - deltaLeft;
                    topMove = b.get('top') - deltaTop;
                    b.set('left', leftMove);    
                    b.set('top', topMove);   
                    handleGraphicChange(b);
                },
                nodeRemoval  = function(id) {
                    var deleteList = stateIndexX[id],targetNodeId,targetPathId,pathData,aEndId,
                    keeperNodeId,p,g,m,k,kLength,a,b;
                    targetNodeId = id;
                    targetPathId = deleteList[0];
                    pathData = state.DungeonConnectPaths[targetPathId];
                    aEndId = pathData.aNodeId;
                    //bEndId = pathData.bNodeId;
                    p = getObj('path', targetPathId);
                    m = getObj('graphic', pathData.mNodeId);
                    g = getObj('path', pathData.clone);
                    a = getObj('graphic', pathData.aNodeId);
                    b = getObj('graphic', pathData.bNodeId);
                    if( targetNodeId === aEndId ){
                        targetNodeId = pathData.aNodeId;
                        keeperNodeId = pathData.bNodeId;
                    }else{
                        targetNodeId = pathData.bNodeId;
                        keeperNodeId = pathData.aNodeId;
                    }
                    kLength = stateIndexX[keeperNodeId].length;
                    delete state.DungeonConnectPaths[targetPathId];
                    stateIndexX[targetNodeId] = _.without(stateIndexX[targetNodeId], targetPathId); 
                    stateIndexX[keeperNodeId] = _.without(stateIndexX[keeperNodeId], targetPathId);    
                    p.set('controlledby', 'removed'); p.remove(); delete stateIndexP[targetPathId];
                    g.set('controlledby', 'removed'); g.remove(); delete stateIndexG[pathData.clone]; 
                    m.set('controlledby', 'removed'); m.remove(); delete stateIndexM[pathData.mNodeId];
                    if ( 1 === kLength ) {
                        k = getObj('graphic', keeperNodeId);
                        k.set('controlledby', 'removed'); 
                        k.remove();
                    }
                    nodeDrawing.PathDestroy(a);
                    nodeDrawing.PathDestroy(b);
                },
                nodeDeleted = function(obj) {
                    var deleteList = stateIndexX[obj.get('id')];
                    if( undefined === deleteList ) {return; }
                    if( 0 === deleteList.length ) {return; }
                    _.each(deleteList, function() {
                        nodeRemoval(obj.get('id'));
                    });
                },
                middleDeleted = function(obj) {
                    var pathData = state.DungeonConnectPaths[stateIndexM[obj.get('id')]],
                    aNode,bNode,b,a,p,g;
                    if( undefined === pathData ) {return; }
                    aNode = stateIndexX[pathData.aNodeId];
                    bNode = stateIndexX[pathData.bNodeId];
                    if( undefined === aNode || undefined === bNode ) {return; }
                    a = getObj('graphic', pathData.aNodeId);
                    b = getObj('graphic', pathData.bNodeId);
                    p = getObj('path', pathData.id);
                    g = getObj('path', pathData.clone);
                    p.set('controlledby', 'removed'); p.remove(); delete stateIndexP[pathData.id];
                    g.set('controlledby', 'removed'); g.remove(); delete stateIndexG[pathData.clone];
                    if( 1 === stateIndexX[pathData.aNodeId].length ){
                        a.set('controlledby', 'removed'); 
                        a.remove(); 
                        delete stateIndexX[pathData.aNodeId];
                    }else{
                        stateIndexX[pathData.aNodeId] = _.without(stateIndexX[pathData.aNodeId], pathData.id);
                    }
                    if( 1 === stateIndexX[pathData.bNodeId].length ){
                        b.set('controlledby', 'removed'); 
                        b.remove(); 
                        delete stateIndexX[pathData.bNodeId];
                    }else{
                        stateIndexX[pathData.bNodeId] = _.without(stateIndexX[pathData.bNodeId], pathData.id);
                    }
                    delete state.DungeonConnectPaths[pathData.id]; 
                    nodeDrawing.PathDestroy(a);
                    nodeDrawing.PathDestroy(b);
                },
                handlePathChange = function(obj) {
                    var pathData, layer;
                    if( 'NEWDungeonConnectPath' === obj.get('controlledby') ) {
                        obj.set('controlledby', 'DungeonConnectPath'); return; 
                    }
                    if( -1 !== obj.get('controlledby').indexOf('DungeonConnectPath') ){
                        pathData = stateIndexP[obj.get('id')];
                        layer = 'walls';
                        if( undefined === pathData ) {
                           pathData = stateIndexG[obj.get('id')];
                           layer = 'objects';
                        }
                        pathData = state.DungeonConnectPaths[pathData];
                        if( undefined === pathData ) {
                           return; 
                        }
                        obj.set({
                            left: pathData.mNodeLeft,
                            top: pathData.mNodeTop,
                            width: pathData.width,
                            height: pathData.height,
                            rotation: 0,
                            scaleX: 1,
                            scaleY: 1,
                            layer: layer
                        });
                    }
                },
                handlePathDestroy = function(obj) {
                    var pathData, m,a,b;
                    if( -1 !== obj.get('controlledby').indexOf('DungeonConnectPath') ){
                        pathData = stateIndexP[obj.get('id')];
                        if( undefined === pathData ) {
                           pathData = stateIndexG[obj.get('id')];
                        }
                        pathData = state.DungeonConnectPaths[pathData];
                        if( undefined === pathData ) {
                           return; 
                        }
                        m = getObj('graphic', pathData.mNodeId);
                        middleDeleted(m);
                        m.remove();
                        a = getObj('graphic', pathData.aNodeId);
                        b = getObj('graphic', pathData.bNodeId);
                        nodeDrawing.PathDestroy(a);
                        nodeDrawing.PathDestroy(b);
                    }
                },
                handleGraphicDestroy = function(obj) {
                    if( 'NEWDungeonConnectPost' === obj.get('controlledby') || 'DungeonConnectPost' === obj.get('controlledby') ) {
                        nodeDeleted(obj); }
                    if( -1 !== obj.get('controlledby').indexOf('MiddlePost') ){
                        middleDeleted(obj); }
                },
                handleGraphicChange = function(obj) {
                    if( 'NEWDungeonConnectPost' === obj.get('controlledby') ) {
                        obj.set('controlledby', 'DungeonConnectPost'); postOverlapCheck(obj); return; }
                    if( 'DungeonConnectPost' === obj.get('controlledby') ) {
                        forceProperPlacementPost(obj); postOverlapCheck(obj); updateSegment(obj); getInput('none');}
                    if( 'NewMiddlePost' === obj.get('controlledby') ) {
                        obj.set('controlledby', 'MiddlePost'); return; }
                    if( -1 !== obj.get('controlledby').indexOf('MiddlePost') ){
                        middlePostMove(obj); }
                },
                registerEventHandlers = function(){
                    on('change:graphic',    handleGraphicChange);
                    on('destroy:graphic',   handleGraphicDestroy);
                    on('destroy:path',      handlePathDestroy);
                    on('change:path',       handlePathChange);
                };
        return {
            RegisterEventHandlers: registerEventHandlers,
            Input: getInput
        };
    }()),
// ~~~> Path Drawing <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  


// ~~~> inputManagement <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  
        inputManagement = (function(){
            var handleInput = function(msg) {
                    var message = _.clone(msg), messageArguments = msg.content.split(/\s+/);
                    if ( ('api' !== message.type) || (true === state.DungeonConnect.processing) || (false === playerIsGM(message.playerid)) ) { return; }
                    if ( messageArguments[0] === '!DungeonConnectMode') { state.DungeonConnect.drawMode = !state.DungeonConnect.drawMode; }
                    if( messageArguments[0] === '!DungeonConnectMore' ) { chatOutput.Input({action: 'menu', text: 'more'});  return; }
                    if( messageArguments[0] === '!DungeonConnectHelp' ) { chatOutput.Input({action: 'help'}); return; }
                    if( (messageArguments[0] === '!DungeonConnectMenu') || (messageArguments[0] === '!DungeonConnectMode') ){
                        chatOutput.Input({action: 'menu', text: ''});
                        return; 
                    }
                    if( false === state.DungeonConnect.drawMode ) { return; }
                    state.DungeonConnect.processing = true;
                    switch(messageArguments[0]) { 
                        //case '!DungeonConnectControl': control(message.playerid); break;
                        case '!DungeonConnectMore':          chatOutput.Input({action: 'menu', text: 'more'});                 break;
                        case '!DungeonConnectAddSegment':    pathDrawing.Input({action: 'AddSegment', message: message});      break;
                        case '!DungeonConnectAddPoint':      pathDrawing.Input({action: 'AddPoint', message: message});        break;
                        case '!DungeonConnectBranchPoint':   pathDrawing.Input({action: 'BranchPoint', message: message});     break;
                        case '!DungeonConnectConnectPoints': pathDrawing.Input({action: 'ConnectPoints', message: message});   break;
                        case '!DungeonConnectMergePoints':   pathDrawing.Input({action: 'MergePoints', message: message});     break;
                        case '!DungeonConnectRemoveSegment': pathDrawing.Input({action: 'RemoveSegment', message: message});   break;
                        case '!DungeonConnectHelp':          chatOutput.Input({action: 'help'});                               break;
                        case '!DungeonConnectChangeTexture': chatOutput.Input({action: 'ChangeTexture'});                      break;
                        case '!DungeonConnectSetTexture':    chatOutput.Input({action: 'SetTexture', message: message});       break;
                        case '!DungeonConnectClear':         utilities.ClearMap(message);                                      break;
                        case '!DungeonConnectFill':          utilities.Fill();                                                 break;
                        case '!DungeonConnectFillCanel':     utilities.FillCancel();                                           break;
                        case '!DungeonConnectFeature':       features.Input({action: 'add', message: message});                break;
                        case '!DungeonConnectToggle':        featuresToggle.Input({action: 'toggle', message: message});       break;
                    }
                    state.DungeonConnect.processing = false;
                },
                registerEventHandlers = function(){
                    on('chat:message', handleInput);
                };
            return {
                RegisterEventHandlers: registerEventHandlers
            };
        }()),
// ~~~> inputManagement <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  
// ~~~> setupPageTracking <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   
        setupPageTracking = (function(){
            var getOwnerPage = function(id) {
                    var playerPages = Campaign().get('playerspecificpages'), ownerPage = playerPages[id];
                    if( undefined === ownerPage ){
                        chatOutput.Input({ action: 'alert', type: 'Caution', text: 'Current page is the player book mark page. <b>Recommend using the party split</b> feature to select the page you wish to edit.'});
                        return Campaign().get('playerpageid');
                    }else{
                        return ownerPage;
                    }
                },
                checkOwnerName = function(players,ownerId) {
                    var whoToTest = _.where(players, {id: ownerId})[0].get('displayname');
                        return _.chain(players).map(function(p){
                            return p.get('displayname');
                        }).filter(function(n){
                            return n === whoToTest;
                        }).value().length === 1;
                },
                eigthBitClockwise = function(value, degree) {
                    var shift = (degree/90) * 2;
                    return (((value | (value << 8)) >> shift) & 255);
                },
                tilePusher = function(pushValues) {
                    var angle = [0,90,180,270];
                    _.each(angle, function(a) {
                        wallTextures.push({
                            key: pushValues.key, pack: pushValues.pack, type: pushValues.type, url: pushValues.url, 
                            value: eigthBitClockwise(pushValues.value, a), degree: a, flip: pushValues.flip
                        });
                    });
                },
                indexState = function() {
                    var keyList = [],indexData;
                    Object.keys(state.DungeonConnectPaths).forEach(function(key) { keyList.push(key); });
                    _.each(keyList, function(eachKey) {
                        indexData = state.DungeonConnectPaths[eachKey];
                        if( undefined === stateIndexX[indexData.aNodeId] ) { stateIndexX[indexData.aNodeId] = []; }
                        stateIndexX[indexData.aNodeId].push(indexData.id);
                        if( undefined === stateIndexX[indexData.bNodeId] ) { stateIndexX[indexData.bNodeId] = []; }
                        stateIndexX[indexData.bNodeId].push(indexData.id);
                        stateIndexABBA[indexData.bNodeId + ':' + indexData.bNodeId] = indexData.id;
                        stateIndexABBA[indexData.aNodeId + ':' + indexData.bNodeId] = indexData.id;
                        stateIndexM[indexData.mNodeId] = indexData.id;
                        stateIndexP[indexData.id] = indexData.id;
                        stateIndexG[indexData.clone] = indexData.id;
                    });
                    keyList = []; 
                    Object.keys(state.DungeonConnectFeatures).forEach(function(key) { keyList.push(key); });
                    _.each(keyList, function(eachKey) {
                        indexData = state.DungeonConnectFeatures[eachKey];
                        stateFeatureIndexGM[indexData.controller] = indexData.feature;
                    });
                },
                loadPack = function() {
                    var tempPack, installedWalls = [], bits,bit8,bit7,bit6,bit5,bit4,bit3,bit2,bit1,flip,fValue,pushValues;
                    Object.keys(DungeonConnectWalls.WallTextures).forEach(function(key) {
                        installedWalls.push(key);
                    });
                    wallTextures = [];
                    _.each(installedWalls, function(eachPack) {
                        tempPack = DungeonConnectWalls.WallTextures[eachPack];
                        _.each(tempPack, function(eachTile) {
                            switch(eachTile.type){
                                case 'node':
                                    pushValues = {
                                        key: eachTile.key, pack: eachPack, type: eachTile.type,url: eachTile.url, 
                                        value: eachTile.value, degree: eachTile.degree, flip: false
                                    };
                                    tilePusher(pushValues);
                                    bits = '00000000' + parseInt(eachTile.value, 10).toString(2);
                                    bits = bits.substr(bits.length - 8);
                                    bit8 = bits.substring(0, 1); bit7 = bits.substring(1, 2); bit6 = bits.substring(2, 3); bit5 = bits.substring(3, 4);
                                    bit4 = bits.substring(4, 5); bit3 = bits.substring(5, 6); bit2 = bits.substring(6, 7); bit1 = bits.substring(7, 8);
                                    flip = bit6+bit7+bit8+bit1+bit2+bit3+bit4+bit5;
                                    fValue = parseInt(flip, 2);
                                    pushValues = {
                                        key: eachTile.key, pack: eachPack, type: eachTile.type,url: eachTile.url, 
                                        value: fValue, degree: eachTile.degree, flip: true
                                    };
                                    tilePusher(pushValues);
                                break;
                                default:
                                wallTextures.push({
                                    key: eachTile.key, pack: eachPack, type: eachTile.type,url: eachTile.url, 
                                    value: eachTile.value, 
                                    degree: eachTile.degree,
                                    flip: false
                                });
                                break;
                            }
                        });
                    });
                },
                refreshData = function() {
                    var players = findObjs({type: 'player'}), ownerId = _.find(_.pluck(players,'id'),playerIsGM);
                    if ( undefined === ownerId ){
                        chatOutput.Input({action: 'alert', type: 'Halt', text: 'Script halted. State failed to initialize due to <b>no GM</b> being found.'});
                    }
                    if( !checkOwnerName(players,ownerId) ) {
                        chatOutput.Input({action: 'alert', type: 'Halt', text: 'Script halted. State failed to initialize due to <b>GMs not having unique names.<b>'});
                    }
                    //delete state.DungeonConnect;
                    //delete state.DungeonConnectPaths;
                    if( ! _.has(state,'DungeonConnect') || state.DungeonConnect.version !== schemaVersion ) {
                        log('DungeonConnect: Initialize State'); 
                        state.DungeonConnect = { 
                            version: schemaVersion, 
                            currentWalls: defaultWalls, 
                            drawMode: true, 
                            processing: false, 
                            owner: ownerId, 
                            who: getObj('player',ownerId).get('_displayname'), 
                            page: getOwnerPage(ownerId)
                        };
                        state.DungeonConnectPaths = {};
                        state.DungeonConnectFeatures = {};
                    }else{
                        state.DungeonConnect.owner = ownerId;
                        state.DungeonConnect.who = getObj('player',ownerId).get('_displayname');
                        state.DungeonConnect.page = getOwnerPage(ownerId);
                    }
                    loadPack();
                    indexState();
                    utilities.MacrosInstall();
                    chatOutput.Input({action: 'main'});
                },    
                registerEventHandlers = function(){
                    on('change:campaign:playerspecificpages',     refreshData);
                    on('change:campaign:playerpageid',            refreshData);
                    on('change:player:_displayname',              refreshData);
                    on('change:player:_online',                   refreshData);
                    refreshData();
                };
            return {
                RegisterEventHandlers: registerEventHandlers
            };
        }()),
// ~~~> setupPageTracking <~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   


        registerEventHandlers = function(){
            var data = new Date(lastUpdate*1000);
            log('Dungeon Connect ' + data + ' version: ' + version + ' Schema Version: ' + schemaVersion);
            setupPageTracking.RegisterEventHandlers();
            inputManagement.RegisterEventHandlers();
            pathDrawing.RegisterEventHandlers();
            wallDrawing.RegisterEventHandlers();
            nodeDrawing.RegisterEventHandlers();
            floorDrawing.RegisterEventHandlers();
            features.RegisterEventHandlers();
            featuresToggle.RegisterEventHandlers();
        };
   return {
       RegisterEventHandlers: registerEventHandlers
   };
}());

on('ready',function(){
    'use strict';
    DungeonConnect.RegisterEventHandlers(); 
});
    
