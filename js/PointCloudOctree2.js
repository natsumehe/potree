

/**
 * Stands in place for invisible or unloaded octree nodes.
 * If a proxy node becomes visible and its geometry has not been loaded,
 * loading will begin.
 * If it is visible and the geometry has been loaded, the proxy node will 
 * be replaced with a point cloud node (THREE.PointCloud as of now)
 */
PCDviewr.PointCloudOctreeProxyNode = function(geometryNode){
	THREE.Object3D.call( this );
	
	this.geometryNode = geometryNode;
	this.boundingBox = geometryNode.boundingBox;
	this.name = geometryNode.name;
	this.level = geometryNode.level;
	this.numPoints = geometryNode.numPoints;
}

PCDviewr.PointCloudOctreeProxyNode.prototype = Object.create(THREE.Object3D.prototype);








PCDviewr.PointCloudOctree = function(geometry, material){
	THREE.Object3D.call( this );

    PCDviewr.PointCloudOctree.lru = PCDviewr.PointCloudOctree.lru || new LRU();
	
	this.pcoGeometry = geometry;
	this.boundingBox = this.pcoGeometry.boundingBox;
	this.material = material;
	this.maxVisibleNodes = 50;
	this.maxVisiblePoints = 2*1000*1000;
	this.level = 0;
	
	this.LODDistance = 20;
	this.LODFalloff = 1.3;
	this.LOD = 4;

    this.ViewMode = "color_Specified"; //color_Texture color_Intensity color_Class color_Height color_Specified(gray)
    this.maxIntensity = geometry.maxIntensity;
    this.minIntensity = geometry.minIntensity;
    this.MaxdeltaIntensity = this.maxIntensity - this.minIntensity;

    var _endPointColors = [];
    _endPointColors.push(new THREE.Vector3(0, 0, 1.0));
    _endPointColors.push(new THREE.Vector3(0, 1.0, 1.0));
    _endPointColors.push(new THREE.Vector3(0, 1.0, 0));
    _endPointColors.push(new THREE.Vector3(1.0, 1.0, 0));
    _endPointColors.push(new THREE.Vector3(1.0, 0, 0));
    this.endPointColors = _endPointColors;
    
    this.statisticalMaxz = geometry.statisticalMaxz;
    this.statisticalMinz = geometry.statisticalMinz;
    this.offset_z = geometry.center.z;
    this.maxHeight = this.statisticalMaxz - this.offset_z;
    this.minHeight = this.statisticalMinz - this.offset_z;
    this.rampLength = this.maxHeight - this.minHeight;
    this.sectionLength = this.rampLength / this.endPointColors.length;

    this.numVisiblePoints = 0;

    this.OBJECTCLASS = {
        NONE:new THREE.Vector3(0.5, 0.5, 0.5),
        UNKNOWN:new THREE.Vector3(0.5, 0.5, 0.5),
        GROUND:new THREE.Vector3(0.94, 0.89, 0.69),
        BUILDING:new THREE.Vector3(0.3, 0.74, 0.77),
        UTILITYPOLE:new THREE.Vector3(0.92, 0.81, 0.0),
        TRAFFICSIGN:new THREE.Vector3(0.90, 0.15, 0.1),
        TREE:new THREE.Vector3(0.56, 0.76, 0.12),
        STREETLAMP:new THREE.Vector3(1.0, 0.5, 0.0),
        ENCLOSURE:new THREE.Vector3(0.65, 0.87, 0.93),
        CAR:new THREE.Vector3(0.72, 0.5, 0.34),
        ROAD:new THREE.Vector3(0.0, 0.0, 1.0),
        ROADMARKING:new THREE.Vector3(1.0, 1.0, 1.0),
        UNKNOWN_POLE:new THREE.Vector3(0.0, 0.0, 0.0),
        POWERLINE:new THREE.Vector3(1.0, 0.68, 0.79),
        CURB:new THREE.Vector3(1.0, 1.0, 1.0),
        BUSH:new THREE.Vector3(0.56, 0.76, 0.12),
        UNKNOWN_PLANE:new THREE.Vector3(0.3, 0.76, 0.87)
    };
/*
    enum OBJECTCLASS
    {
        NONE = -1,		//未启用类别
            UNKNOWN = 0,	//未知类别
            GROUND,			//地面;
            BUILDING,       //建筑物;
            UTILITYPOLE,    //电线杆;
            TRAFFICSIGN,    //交通标志牌;
            TREE,           //树;
            STREETLAMP,     //路灯;
            ENCLOSURE,      //围墙;
            CAR,            //汽车;
            ROAD,
            ROADMARKING,		//交通标线;
            UNKNOWN_POLE,
            POWERLINE,
            CURB,
            BUSH,
            UNKNOWN_PLANE
    };

    const osg::Vec3f DEFAULT_CLASS_COLORS[] = {
    //未分类;
    { 0.5f, 0.5f, 0.5f },
    //地面
    { 0.94f, 0.89f, 0.69f },
    //建筑物;
    { 0.3f, 0.74f, 0.77f },
    //电线杆;
    { 0.92f, 0.81f, 0.0f },
    //标牌;
    { 0.90f, 0.15f, 0.1f },
    //树木;
    { 0.56f, 0.76f, 0.12f },
    //路灯;
    { 1.0f, 0.5f, 0.0f },
    //围墙;
    { 0.65f, 0.87f, 0.93f },
    //汽车;
    { 0.72f, 0.5f, 0.34f },
    //road
    { 0.0f, 0.0f, 1.0f },
    //ROADMARKING
    { 1.0f, 1.0f, 1.0f },
    //UNKNOWN_POLE
    { 0.0f, 0.0f, 0.0f },
    //POWERLINE
    { 1.0f, 0.68f, 0.79f },
    //CURB
    { 1.0f, 1.f, 1.f},
    //BUSH;
    { 0.56f, 0.76f, 0.12f },
    //UNKNOWN_PLANE;
    { 0.3f, 0.76f, 0.87f }
};  */
	
	var rootProxy = new PCDviewr.PointCloudOctreeProxyNode(this.pcoGeometry.root);
	this.add(rootProxy);  //this -> THREE.Object3D
}

PCDviewr.PointCloudOctree.prototype = Object.create(THREE.Object3D.prototype);

PCDviewr.PointCloudOctree.prototype.update = function(camera){
	this.numVisibleNodes = 0;
	this.numVisiblePoints = 0;
	var frustum = new THREE.Frustum();
	frustum.setFromMatrix( new THREE.Matrix4().multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );
	
	// check visibility
	var stack = [];
	stack.push(this);
	while(stack.length > 0){
		var object = stack.shift();
		
		var boxWorld = PCDviewr.utils.computeTransformedBoundingBox(object.boundingBox, object.matrixWorld);
		var camWorldPos = new THREE.Vector3().setFromMatrixPosition( camera.matrixWorld );
		var distance = boxWorld.center().distanceTo(camWorldPos);
		var radius = boxWorld.size().length() * 0.5;
		//var ratio = distance/(1100/this.LOD);
		var visible = true;
        //if(object.numPoints == 0 || object.numPoints === undefined) visible = false;
		visible = visible && frustum.intersectsBox(boxWorld);
		if(object.level >= 1){
            //visible = visible && (ratio>=(this.LOD - object.level) && ratio<(this.LOD + 1 - object.level));
            visible = visible && radius / distance > (/*1.17*/1 / this.LOD);
			//visible = visible && (this.numVisiblePoints + object.numPoints < PCDviewr.pointLoadLimit);
            visible = visible && (this.numVisiblePoints < 1000000);
			visible = visible && (this.numVisibleNodes <= this.maxVisibleNodes);
			//visible = visible && (this.numVisiblePoints <= this.maxVisiblePoints);
		}else{
			visible = true;
		}

		object.visible = visible;
		
		if(!visible){
			this.hideDescendants(object);
			continue;
		}
		
		if(object instanceof THREE.Points){    //THREE.PointCloud -> THREE.Points
			this.numVisibleNodes++;
			this.numVisiblePoints += object.numPoints;
            this.setViewMode(object);
            PCDviewr.PointCloudOctree.lru.touch(object);
		}else if (object instanceof PCDviewr.PointCloudOctreeProxyNode) {
			this.replaceProxy(object);
		}
		
		for(var i = 0; i < object.children.length; i++){
			stack.push(object.children[i]);
		}
	}
}


PCDviewr.PointCloudOctree.prototype.replaceProxy = function(proxy){
	
	var geometryNode = proxy.geometryNode;
	if(geometryNode.loaded == true){
		var geometry = geometryNode.geometry;
        geometry.ViewMode = "color_Specified";
		var node = new THREE.Points(geometry, this.material);  //THREE.PointCloud -> THREE.Points
		node.name = proxy.name;
		node.level = proxy.level;
		node.numPoints = proxy.numPoints;
		node.boundingBox = geometry.boundingBox;
		node.pcoGeometry = geometryNode;
        //this.setViewMode(node);
        node.geometry.colorsNeedUpdate = true;
		var parent = proxy.parent;
		parent.remove(proxy);
		parent.add(node);
        this.numVisiblePoints += node.numPoints  //
		for(var i = 0; i < 8; i++){      // 8 -> geometryNode.children.length
			if(geometryNode.children[i] !== undefined){
				var child = geometryNode.children[i];
				var childProxy = new PCDviewr.PointCloudOctreeProxyNode(child);
				node.add(childProxy);
			}
		}
	}else{
        this.numVisiblePoints += geometryNode.load(this.pcoGeometry.url + "/" + this.pcoGeometry.cache_folder);  //
	}
}

PCDviewr.PointCloudOctree.prototype.setViewMode = function(Three_Points){
    if(Three_Points.geometry.ViewMode != this.ViewMode){
        switch ( this.ViewMode ){
            case "color_Specified":
                for(var i = 0;i<Three_Points.geometry.attributes.position.count;i++){
                    Three_Points.geometry.attributes.color.array[3*i] = specifiedColor = 0;
                    Three_Points.geometry.attributes.color.array[3*i+1] = specifiedColor = 0;
                    Three_Points.geometry.attributes.color.array[3*i+2] = specifiedColor = 0;
                }
                 
                Three_Points.geometry.ViewMode = "color_Specified";
                Three_Points.geometry.attributes.color.needsUpdate = true;
                break;
            case "color_Texture":
                for(var i = 0;i<Three_Points.geometry.attributes.position.count;i++){
                    Three_Points.geometry.attributes.color.array[3*i] = Three_Points.geometry.attributes.RGB.array[3*i];
                    Three_Points.geometry.attributes.color.array[3*i+1] = Three_Points.geometry.attributes.RGB.array[3*i+1];
                    Three_Points.geometry.attributes.color.array[3*i+2] = Three_Points.geometry.attributes.RGB.array[3*i+2];
                }
                Three_Points.geometry.ViewMode = "color_Texture";
                Three_Points.geometry.attributes.color.needsUpdate = true;
                break;
            case "color_Intensity":
                for(var i = 0;i<Three_Points.geometry.attributes.position.count;i++){
                    var color = (Three_Points.geometry.attributes.intensity.array[i] - this.minIntensity) / this.MaxdeltaIntensity;
                    Three_Points.geometry.attributes.color.array[3*i] = color;
                    Three_Points.geometry.attributes.color.array[3*i+1] = color;
                    Three_Points.geometry.attributes.color.array[3*i+2] = color;
                }
                Three_Points.geometry.ViewMode = "color_Intensity";
                Three_Points.geometry.attributes.color.needsUpdate = true;
                break;
            case "color_Class":
                for(var i = 0;i<Three_Points.geometry.attributes.position.count;i++){
                    var color = this.getColorByClass(Three_Points.geometry.attributes.class.array[i]);
                    Three_Points.geometry.attributes.color.array[3*i] = color.x;
                    Three_Points.geometry.attributes.color.array[3*i+1] = color.y;
                    Three_Points.geometry.attributes.color.array[3*i+2] = color.z;
                }
                Three_Points.geometry.ViewMode = "color_Class";
                Three_Points.geometry.attributes.color.needsUpdate = true;
                break;
            case "color_Height":
                for(var i = 0;i<Three_Points.geometry.attributes.position.count;i++){
                    var color = this.getColorByHeight(Three_Points.geometry.attributes.position.array[3*i+2]);
                    Three_Points.geometry.attributes.color.array[3*i] = color.x;
                    Three_Points.geometry.attributes.color.array[3*i+1] = color.y;
                    Three_Points.geometry.attributes.color.array[3*i+2] = color.z;
                }
                Three_Points.geometry.ViewMode = "color_Height";
                Three_Points.geometry.attributes.color.needsUpdate = true;
                break;
            default :
                console.log('what\'s wrong!!');
        }
    }
}

PCDviewr.PointCloudOctree.prototype.getColorByClass = function(Class){
    switch(Class){
        case "NONE":
            return this.NONE;
            break;
        case "UNKNOWN":
            return this.NONE;
            break;
        case "GROUND":
            return this.NONE;
            break;
        case "BUILDING":
            return this.NONE;
            break;
        case "UTILITYPOLE":
            return this.NONE;
            break;
        case "TRAFFICSIGN":
            return this.NONE;
            break;
        case "TREE":
            return this.NONE;
            break;
        case "STREETLAMP":
            return this.NONE;
            break;
        case "ENCLOSURE":
            return this.NONE;
            break;
        case "CAR":
            return this.NONE;
            break;
        case "ROAD":
            return this.NONE;
            break;
        case "ROADMARKING":
            return this.NONE;
            break;
        case "UNKNOWN_POLE":
            return this.NONE;
            break;
        case "POWERLINE":
            return this.NONE;
            break;
        case "CURB":
            return this.NONE;
            break;
        case "BUSH":
            return this.NONE;
            break;
        case "UNKNOWN_PLANE":
            return this.NONE;
            break;
        default :
            console.log("Error Object Class!");
    }
}

PCDviewr.PointCloudOctree.prototype.getColorByHeight = function(height){
    var relevant_val = height - this.minHeight;
    var index = Math.floor(relevant_val/this.sectionLength);
    var maxIndex = this.endPointColors.length - 1;
    var color = new THREE.Vector3();
    if (index >= maxIndex)
    {
        index = this.endPointColors.length - 1;
        color = this.endPointColors[index];
    }
    else if (index < 0)	//考虑噪点小于统计出的最低高程的情况  modified by zhaogang. 2014.09.23
    {
        index = 0;
        color = this.endPointColors[index];
    }
    else
    {
        var remainder = relevant_val - this.sectionLength * index;
        var ratio = remainder / this.sectionLength;
        var stColor = this.endPointColors[index];
        var endColor = this.endPointColors[index + 1];
        color.x = (endColor.x - stColor.x) * ratio + stColor.x;
        color.y = (endColor.y - stColor.y) * ratio + stColor.y;
        color.z = (endColor.z - stColor.z) * ratio + stColor.z;
    }
    return color;
}

PCDviewr.PointCloudOctree.prototype.hideDescendants = function(object){
	var stack = [];
	for(var i = 0; i < object.children.length; i++){
		var child = object.children[i];
		if(child.visible){
			stack.push(child);
		}
	}
	
	while(stack.length > 0){
		var object = stack.shift();
        if(object.loaded)  this.numVisiblePoints -= object.numPoints;//
		object.visible = false;

		for(var i = 0; i < object.children.length; i++){
			var child = object.children[i];
			if(child.visible){
				stack.push(child);
			}
		}
	}
}

PCDviewr.PointCloudOctree.prototype.moveToOrigin = function(){
    this.position.set(0,0,0);
    this.updateMatrixWorld();
    var box = this.boundingBox;
    var transform = this.matrixWorld;
    var tBox = PCDviewr.utils.computeTransformedBoundingBox(box, transform);
    this.position.set(0,0,0).sub(tBox.center());
}

PCDviewr.PointCloudOctree.prototype.moveToGroundPlane = function(){
    this.updateMatrixWorld();
    var box = this.boundingBox;
    var transform = this.matrixWorld;
    var tBox = PCDviewr.utils.computeTransformedBoundingBox(box, transform);
    this.position.y += -tBox.min.y;
}


/**
 *
 * amount: minimum number of points to remove
 */
PCDviewr.PointCloudOctree.disposeLeastRecentlyUsed = function(amount){
	
	
	var freed = 0;
	do{
		var node = this.lru.first.node;
		var parent = node.parent;
		var geometry = node.geometry;
		var pcoGeometry = node.pcoGeometry;
		var proxy = new PCDviewr.PointCloudOctreeProxyNode(pcoGeometry);
	
		var result = PCDviewr.PointCloudOctree.disposeNode(node);
		freed += result.freed;
		
		parent.add(proxy);
		
		if(result.numDeletedNodes == 0){
			break;
		}
	}while(freed < amount);
}

PCDviewr.PointCloudOctree.disposeNode = function(node){
	
	var freed = 0;
	var numDeletedNodes = 0;
	var descendants = [];
	
	node.traverse(function(object){
		descendants.push(object);
	});
	
	for(var i = 0; i < descendants.length; i++){
		var descendant = descendants[i];
		if(descendant instanceof THREE.Points){    //THREE.PointCloud -> THREE.Points
			freed += descendant.pcoGeometry.numPoints;
			descendant.pcoGeometry.dispose();
			descendant.geometry.dispose();
            PCDviewr.PointCloudOctree.lru.remove(descendant);
			numDeletedNodes++;
		}
	}

    PCDviewr.PointCloudOctree.lru.remove(node);
	node.parent.remove(node);
	
	return {
		"freed": freed,
		"numDeletedNodes": numDeletedNodes
	};
}