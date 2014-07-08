/**
 * This object takes care of all the visualization:
 *
 * FEATURES
 * - Give it a JSON object which represents the 'scene'
 * - Allows users to selects elements of the scene to be rendered
 * - Allows basic image processing (thresholding, Volume Rendering (VR), Fibers Length Thresholding, etc.)
 * - Expose some functions
 *
 * TECHNOLOGY
 * - XTK
 * - xdatgui.js
 * - SliceDrop clone
 * - fancytree
 */

// Declare (or re-declare) the single global variable
var viewer = viewer || {};


viewer.Viewer = function(jsonObj) {

  this.version = 0.0;
  //Parse the json file
  this.source = jsonObj;

  // collaborator object
  this.collaborator = null;

  //rendered volume
  this.volume = null;

  this.volumeBBox = null;
  this.bbox = true;

  this.sceneOrientation = 0;
  this.mode = 0;

  // true == ignore orientation
  // false == use orientation
  this.reslice = 'false';
  this.reslice2 = false;

  //rendered geometric models (eg. fibers and meshes)
  this.geomModels = [];

  //file selection widget
  this.fileSelectWidget = null;
  this.createFileSelectTree('tree');

  // volume GUI widget
  this.volWidget = null;

  // try to create and initialize a 3D renderer
  this._webGLFriendly = true;
  try {
    this.create3DRenderer('vol3D');
  } catch (Exception) {
    this._webGLFriendly = false;
  }
  // create 2D renderers for the X, Y, Z orientations
  this.create2DRenderer('sliceXX', 'X');
  this.create2DRenderer('sliceYY', 'Y');
  this.create2DRenderer('sliceZZ', 'Z');

  // the onShowtime method gets executed after all files were fully loaded and
  // just before the first rendering attempt
  var self = this;
  this.sliceXX.onShowtime = function() {
    // add the volume to the other 3 renderers
    self.sliceYY.add(self.volume);
    self.sliceYY.render();
    self.sliceZZ.add(self.volume);
    self.sliceZZ.render();

    // make sure to re-paint
    self['sliceXX'].update(self.volume);
    self['sliceYY'].update(self.volume);
    self['sliceZZ'].update(self.volume);

    if (self._webGLFriendly) {
      // no need to worry about the other showtimes
      self['vol3D'].resetBoundingBox();
      self.createBBox();
      self['vol3D'].add(self.volumeBBox);
      self['vol3D'].add(self.volume);
      self['vol3D'].camera.position = [0, 0, 200];
      self['vol3D'].render();
    }
    // now the volume GUI widget
    if (!self.volWidget) {
      self.createVolWidget('xcontroller');
    } else {
      self.updateVolWidget();
    }
  };

  //Event handler for full screen behaviour when main container is double clicked
  document.getElementById('render3D').addEventListener('dblclick', self.onThreeDContDblClick.bind(self));

  //Event handlers for switching renderers
  document.getElementById('sliceX').addEventListener('click', self.onTwoDContClick.bind(self, 'sliceX'));
  document.getElementById('sliceY').addEventListener('click', self.onTwoDContClick.bind(self, 'sliceY'));
  document.getElementById('sliceZ').addEventListener('click', self.onTwoDContClick.bind(self, 'sliceZ'));

}


viewer.Viewer.prototype.create3DRenderer = function(container) {
  this[container] = new X.renderer3D();
  this[container].bgColor = [.1, .1, .1];
  this[container].container = container;
  this[container].init();
  self = this;
  //3D renderer's ROTATE event handler (update the camera view)
  this[container].interactor.addEventListener(X.event.events.ROTATE,
    function(){self.updateSceneView();});
  this[container].interactor.onTouchStart = this[container].interactor.onMouseDown = function(){ self.onTouchStart(); };
  this[container].interactor.onTouchEnd = this[container].interactor.onMouseUp = function(){ self.onTouchEnd(); };
}


viewer.Viewer.prototype.create2DRenderer = function(container, orientation) {
  this[container] = new X.renderer2D();
  this[container].container = container;
  this[container].orientation = orientation;
  this[container].init();
}


viewer.Viewer.prototype.createFileSelectTree = function(container) {
  var self = this;

  $('#' + container).fancytree({
    checkbox: true,
    source: this.source,

    select: function(event, data) {
      var node = data.node;

      if (node.data.type == 'volume') {
        if (node.isSelected()) {
          if (self.volume != null) {
            var prevSelectedNode = self.fileSelectTree.getNodeByKey(self.volume.key);
            //uncheck previously selected volume node and call the select event
            prevSelectedNode.setSelected(false);
          }
          self.setVolume(node);
        } else {
          self.unsetVolume();
        }
      } else {
        if (node.isSelected()) {
          self.addGeomModel(node);
        } else {
          self.remGeomModel(node);
        }
      };
    },

    keydown: function(event, data) {
      var node = data.node;

      if (event.which === 13) {
        if (node.isFolder()) {
          node.toggleExpanded();
        } else {
          node.toggleSelected();
        }
      }
    }
  });

  this.fileSelectTree = $('#' + container).fancytree("getTree");
}


viewer.Viewer.prototype.createBBox = function(){

    var res = [this.volume.bbox[0],this.volume.bbox[2],this.volume.bbox[4]];
    var res2 = [this.volume.bbox[1],this.volume.bbox[3],this.volume.bbox[5]];

    this.volumeBBox = new X.object();
    this.volumeBBox.points = new X.triplets(72);
    this.volumeBBox.normals = new X.triplets(72);
    this.volumeBBox.type = 'LINES';
    this.volumeBBox.points.add(res2[0], res[1], res2[2]);
    this.volumeBBox.points.add(res[0], res[1], res2[2]);
    this.volumeBBox.points.add(res2[0], res2[1], res2[2]);
    this.volumeBBox.points.add(res[0], res2[1], res2[2]);
    this.volumeBBox.points.add(res2[0], res[1], res[2]);
    this.volumeBBox.points.add(res[0], res[1], res[2]);
    this.volumeBBox.points.add(res2[0], res2[1], res[2]);
    this.volumeBBox.points.add(res[0], res2[1], res[2]);
    this.volumeBBox.points.add(res2[0], res[1], res2[2]);
    this.volumeBBox.points.add(res2[0], res[1], res[2]);
    this.volumeBBox.points.add(res[0], res[1], res2[2]);
    this.volumeBBox.points.add(res[0], res[1], res[2]);
    this.volumeBBox.points.add(res2[0], res2[1], res2[2]);
    this.volumeBBox.points.add(res2[0], res2[1], res[2]);
    this.volumeBBox.points.add(res[0], res2[1], res2[2]);
    this.volumeBBox.points.add(res[0], res2[1], res[2]);
    this.volumeBBox.points.add(res2[0], res2[1], res2[2]);
    this.volumeBBox.points.add(res2[0], res[1], res2[2]);
    this.volumeBBox.points.add(res[0], res2[1], res2[2]);
    this.volumeBBox.points.add(res[0], res[1], res2[2]);
    this.volumeBBox.points.add(res[0], res2[1], res[2]);
    this.volumeBBox.points.add(res[0], res[1], res[2]);
    this.volumeBBox.points.add(res2[0], res2[1], res[2]);
    this.volumeBBox.points.add(res2[0], res[1], res[2]);
    for ( var i = 0; i < 24; ++i) {
      this.volumeBBox.normals.add(0, 0, 0);
    }

    this.volumeBBox.visible = this.bbox;

}


viewer.Viewer.prototype.setVolume = function(nodeObj) {

  var orderedFiles, files, url;

  url = nodeObj.data.url;

  // for the dicom format, files is a list of strings
  // for other formats it's a list with just a single string
  files = nodeObj.data.files;
  orderedFiles = files.sort().map(function(str) {
      return url + '/' + str;});

  this.volume = new X.volume();
  this.volume.reslicing = this.reslice;
  this.volume.file = orderedFiles;
  this.volume.key = nodeObj.key;

  this.sliceXX.add(this.volume);
  // start the loading/rendering
  this.sliceXX.render();
}


viewer.Viewer.prototype.unsetVolume = function() {
  // remove from the visualization
  if (this._webGLFriendly) {
    this['vol3D'].remove(this.volume);
    this['vol3D'].remove(this.volumeBBox);
  }

    this['sliceXX'].remove(this.volume);
    this['sliceYY'].remove(this.volume);
    this['sliceZZ'].remove(this.volume);

    this.volume.destroy();
    this.volume = null;

    this.volumeBBox.destroy();
    this.volumeBBox = null;

}


viewer.Viewer.prototype.updateVolume = function() {
  if(this.volume != null){
    var nodeObj = this.fileSelectTree.getNodeByKey(this.volume.key);
    this.unsetVolume();
    this.setVolume(nodeObj);
  }
}


viewer.Viewer.prototype.addGeomModel = function(nodeObj) {
  var xtkObj;

  if (this._webGLFriendly && (this.indexOfGeomModel(nodeObj.key) == -1)) {
    xtkObj = new X[nodeObj.data.type]();
    xtkObj.file = nodeObj.data.url + '/' + nodeObj.data.files;
    xtkObj.key = nodeObj.key;
    this.geomModels.push(xtkObj);
    this['vol3D'].add(xtkObj);
    this['vol3D'].camera.position = [0, 0, 200];
    this['vol3D'].render();
  }
}


viewer.Viewer.prototype.remGeomModel = function(nodeObj) {
  var ix = this.indexOfGeomModel(nodeObj.key);

  if (ix != -1) {
    this['vol3D'].remove(this.geomModels[ix]);
    this.geomModels[ix].destroy();
    this.geomModels[ix] = null;
    this.geomModels.splice(ix,1);
  }
}


viewer.Viewer.prototype.indexOfGeomModel = function(key) {
  if (this.geomModels) {
    for (var i = 0; i < this.geomModels.length; i++) {
      if (this.geomModels[i].key == key) {
        return i;
      }
    }
  }
  return -1;
}


viewer.Viewer.prototype.onThreshold = function() {

  window.console.log('Lets threshold!');
  //this.threeDRenderer

}


viewer.Viewer.prototype.createVolWidget = function(container) {
    this.volWidget = {};
    var gui = new dat.GUI({ autoPlace: false });
    var customContainer = document.getElementById(container);
    customContainer.appendChild(gui.domElement);
    this.volWidget.container = customContainer;
    this.volWidget.view = gui.addFolder('View');
    // $('.interactive_plugin_content').css("background-color", "#000");
    // the following configures the gui for interacting with the X.volume
    // this.volWidget.interact = gui.addFolder('Volume Interaction');
    this.populateVolWidget();

}


viewer.Viewer.prototype.populateVolWidget = function() {
  // now we can configure controllers ..
  //view mode
  this.volWidget.view.sliceMode = this.volWidget.view.add(this, 'mode', { 'Default':0, 'Rotate Box':1});
  this.volWidget.view.bboxMode = this.volWidget.view.add(this, 'bbox').name('Show BBox');
  this.volWidget.view.orientationMode = this.volWidget.view.add(this, 'reslice2').name('Reslice');
  this.volWidget.view.orientation = this.volWidget.view.add(this, 'sceneOrientation',
   { Free: 0, Blue: 1, Red: 2, Green: 3 }).name('orientation');
  this.volWidget.view.open();

  // connect callbacks
  var self = this;
  this.volWidget.view.bboxMode.onChange(function(value) {
    if(self.volumeBBox != null){
        self.volumeBBox.visible = value;
    }
  });

  this.volWidget.view.orientationMode.onChange(function(value) {
    // Delete current volume
    if(value){
        self.reslice = 'true';
    }
    else{
        self.reslice = 'false';
    }
    self.updateVolume();
  });

  this.volWidget.view.orientation.onChange(function(value){
    if(value == 2){
      // move camera
      self['vol3D'].camera.position = [-400, 0, 0];
      self['vol3D'].camera.up = [0, 0, 1];
    }
    else if(value == 3){
      // move camera
      self['vol3D'].camera.position = [0, 400, 0];
      self['vol3D'].camera.up = [0, 0, 1];
    }
    else if(value == 1){
      // move camera
      self['vol3D'].camera.position = [0, 0, -400];
      self['vol3D'].camera.up = [0, 1, 0];
    }
  });
}


viewer.Viewer.prototype.updateSceneView = function(){

  // if reslice mode, update the renderers by default
  // else reset normals to default (or RASIJK vals?)
  if(this.volWidget.view.sliceMode.getValue() == 1){
    var _x = this['vol3D'].camera.view[2];
    var _y = this['vol3D'].camera.view[6];
    var _z = this['vol3D'].camera.view[10];
    // normalize
    var length = Math.sqrt(_x*_x + _y*_y+_z*_z);

    // Update X
    this.volume.xNormX = _x/length;
    this.volume.xNormY = _y/length;
    this.volume.xNormZ = _z/length;

    this.volume.sliceInfoChanged(0);

    // get new slice normal
    var sliceX = this.volume.children[0].children[this.volume.indexX];
    // window.console.log();

    // Update Y
    this.volume.yNormX = sliceX.up[0];
    this.volume.yNormY = sliceX.up[1];
    this.volume.yNormZ = sliceX.up[2];

    this.volume.sliceInfoChanged(1);

    // Update Z
    this.volume.zNormX = sliceX.right[0];
    this.volume.zNormY = sliceX.right[1];
    this.volume.zNormZ = sliceX.right[2];

    this.volume.sliceInfoChanged(2);

    // only triggers 1 3d renderer

    // this.volume.modified();
    this['sliceXX'].update(this.volume);
    this['sliceYY'].update(this.volume);
    this['sliceZZ'].update(this.volume);
    }

}


viewer.Viewer.prototype.updateVolWidget = function() {
  this.volWidget.view.remove(this.volWidget.view.sliceMode);
  this.volWidget.view.remove(this.volWidget.view.bboxMode);
  this.volWidget.view.remove(this.volWidget.view.orientationMode);
  this.volWidget.view.remove(this.volWidget.view.orientation);
  this.populateVolWidget();
}


//COLLABORATION: Local and Remote event handlers
//Register remote actions with their local handlers
viewer.Viewer.prototype.connect = function(){
  var self = this;
  this.collaborator.register('cameraViewChanged', function(msgObj) {self.onRemoteCameraViewChange(msgObj);});
  this.collaborator.register('ThreeDContDblClicked', function(msgObj) {self.onRemoteThreeDContDblClick(msgObj);});
  this.collaborator.register('TwoDContClicked', function(msgObj) {self.onRemoteTwoDContClick(msgObj);});
}


viewer.Viewer.prototype.onThreeDContDblClick = function() {
  var contHeight = this._ThreeDContDblClickHandler();

  this.collaborator.send('ThreeDContDblClicked', contHeight);
}


viewer.Viewer.prototype.onRemoteThreeDContDblClick = function(msgObj) {
  var contHeight = JSON.parse(msgObj.data);
  var render3D = document.getElementById('render3D');

  if (render3D.style.height != contHeight) {
    this._ThreeDContDblClickHandler();
  }
}


viewer.Viewer.prototype._ThreeDContDblClickHandler = function() {
  var render3D = document.getElementById('render3D');
  var render2D = document.getElementById('render2D');

  if (render3D.style.height == '100%') {
      render2D.style.display = 'block';
      render3D.style.height = '70%';
  } else {
      render2D.style.display = 'none';
      render3D.style.height = '100%'
  }
  //repaint
  viewer.documentRepaint();
  return render3D.style.height;
}


viewer.Viewer.prototype.onTwoDContClick = function(cont) {
  window.console.log('sent: ', cont);
  this.collaborator.send('TwoDContClicked', cont);
  this._TwoDContClickHandler(cont);
}


viewer.Viewer.prototype.onRemoteTwoDContClick = function(msgObj) {
  var cont = JSON.parse(msgObj.data);
  window.console.log('received: ', cont);
  this._TwoDContClickHandler(cont);
}


viewer.Viewer.prototype._TwoDContClickHandler = function(cont) {
  var contObj = document.getElementById(cont);
  var twoDRenderer = viewer.firstChild(contObj);
  var threeD = document.getElementById('render3D');
  var threeDRenderer = viewer.firstChild(threeD);

  contObj.replaceChild(threeDRenderer, twoDRenderer);
  threeD.insertBefore(twoDRenderer, threeD.firstChild);
  //threed.appendChild(renderer);
  //repaint
  viewer.documentRepaint();
}


// grab the camera view state every 20 mms after touch start and until touch end
viewer.Viewer.prototype.onTouchStart = function(){
    var self = this;
    _CHRIS_INTERACTIVE_PLUGIN_._updater = setInterval(function(){
            self.onCameraViewChange(self['vol3D'].camera.view);
        }, 20);
}


viewer.Viewer.prototype.onTouchEnd = function(){
  clearInterval(_CHRIS_INTERACTIVE_PLUGIN_._updater);
}


// local camera view change handler
viewer.Viewer.prototype.onCameraViewChange = function(dataObj){

  window.console.log('send: ' + dataObj);

  this.collaborator.send('cameraViewChanged', dataObj);

}


// remote camera view change handler
viewer.Viewer.prototype.onRemoteCameraViewChange = function(msgObj){

  window.console.log('received: ' + msgObj);
  window.console.log(this);

  var obj = JSON.parse(msgObj.data);
  var arr = $.map(obj, function(el) { return el; });
  this['vol3D'].camera.view = new Float32Array(arr);
}


viewer.Viewer.prototype.destroy = function(){
    // destroy the fancy tree
    $("#tree").fancytree("destroy");

    // listeners
    var self = this;
    document.getElementById('render3D').removeEventListener('dblclick', self.ThreeDContDClickHandler);
    document.getElementById('sliceX').removeEventListener('click', self.TwoDContClickHandler);
    document.getElementById('sliceY').removeEventListener('click', self.TwoDContClickHandler);
    document.getElementById('sliceZ').removeEventListener('click', self.TwoDContClickHandler);

    // top right widget must be destroyed if any!
    if(this.volWidget != null){
        this.volWidget.container.removeChild(this.volWidget.container.lastChild);
        this.volWidget = null;
    }

    // delete all elements contained in the scene
    if(this.volume != null){
        this.unsetVolume();
    }

    if (this.geomModels != []) {
        // iterate backwards to handle splice in remGeomModel
        var len = this.geomModels.length;
        while (len--) {
            this.remGeomModel(len);
        }
    }
    this.geomModels.length = [];

    // destroy XTK renderers
    this['vol3D'].destroy();
    this['vol3D'] = null;
    this['sliceXX'].destroy();
    this['sliceXX'] = null;
    this['sliceYY'].destroy();
    this['sliceYY'] = null;
    this['sliceZZ'].destroy();
    this['sliceZZ'] = null;

}

//Find the first child which is an element node
viewer.firstChild = function(DOMObj) {
  var x = DOMObj.firstChild;
  while ((x != null) && (x.nodeType != 1)) {
    x = x.nextSibling;
  }
  return x;
}

//repaint
viewer.documentRepaint = function() {
  var ev = document.createEvent('Event');
  ev.initEvent('resize', true, true);
  window.dispatchEvent(ev);
}
