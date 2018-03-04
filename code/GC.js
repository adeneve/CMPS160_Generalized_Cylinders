//Andrew de Neve
//11/6/2017 
//ver2 calculate colors while drawing

//Vertex shader source code for the GLSL compiler
var vertexSource =
'attribute vec4 a_Position; \n'+  //vector that points to first vertex in the vertex buffer
'attribute vec4 a_Normal; \n'+  //either set to flat normals, or smooth normals
'uniform vec4 u_Color; \n'+   // color of object (red) also alpha value represents an object.
'uniform vec4 u_Directional_Light; \n'+
'uniform vec4 u_Point_Light; \n' +
'uniform vec3 u_Directional_Light_Color; \n'+  //white
'uniform vec3 u_Directional_Light_Direction; \n'+ //(1,1,1) coming into the screen downward 
'uniform vec3 u_Point_Light_Color; \n'+ //yellow 
'uniform vec4 u_Point_Light_Location; \n'+ //(0,500,0) scaling fixed after ortho projection
'uniform vec3 u_Specular_Light_Color; \n'+
'uniform float u_glossiness; \n'+
'uniform vec3 u_View_From;  \n'+
'uniform mat4 u_orthoMat; \n'+
'uniform mat4 u_viewMat; \n'+
'uniform mat4 u_Trans_OriginM; \n'+
'uniform mat4 u_Trans_BackM; \n'+
'uniform mat4 u_Rot_Mat; \n'+
'uniform mat4 u_Scale_Mat; \n'+
'uniform mat4 u_TransM; \n'+
'uniform mat4 u_inverseTranspose; \n'+
'uniform bool DirectionalLight_on; \n'+
'uniform bool PointLight_on; \n'+
'uniform bool Specular_on; \n'+
'uniform bool basicDraw; \n'+
'varying vec4 v_Color; \n'+
'void main(){ \n' +
' gl_Position =  u_orthoMat*u_viewMat*u_TransM*u_Trans_BackM*u_Scale_Mat*u_Rot_Mat*u_Trans_OriginM*a_Position; \n' +  
' vec3 normal = normalize(vec3(u_inverseTranspose*a_Normal)); \n' +
' vec3 diffuse = vec3(0.0,0.0,0.0); \n'+ //takes into account directional lighting and point light
' vec3 ambient = vec3(0.0,0.0,0.2); \n'+ 
' vec3 specular = vec3(0.0,0.0,0.0); \n'+
' if(DirectionalLight_on){ '+ 
'      float nDotL = max(dot(u_Directional_Light_Direction, normal), 0.0); \n'+
'      diffuse += u_Directional_Light_Color * vec3(u_Color) * nDotL; \n'+
'      if(Specular_on){ '+
'          vec3 half_vector =  u_Directional_Light_Direction + normalize(u_View_From); \n'+ 
'          float nDotL = max(dot(normalize(half_vector), normal), 0.0); \n'+ 
'          float nDotL2 = pow(nDotL, u_glossiness); \n'+
'          specular += u_Specular_Light_Color * u_Directional_Light_Color * nDotL2; \n'+
'       }  '+
'} '+
' if(PointLight_on){ '+
'      vec3 difference_vector = vec3(u_orthoMat*u_Point_Light_Location) - vec3(u_orthoMat*u_viewMat*u_TransM*u_Trans_BackM*u_Scale_Mat*u_Rot_Mat*u_Trans_OriginM*a_Position); \n'+
'      vec3 diff_normalized = normalize(difference_vector); \n'+
'      float nDotL = max(dot(diff_normalized, normal), 0.0); \n'+ 
'      diffuse += u_Point_Light_Color * vec3(u_Color) * nDotL; \n'+
'      if(Specular_on){'+ 
'      vec3 half_vector = diff_normalized + normalize(u_View_From); \n'+ 
'      float nDotL = max(dot(normalize(half_vector), normal), 0.0); \n'+
'      float nDotL2 = pow(nDotL, u_glossiness); \n'+
'      specular += u_Specular_Light_Color * u_Point_Light_Color * nDotL2; \n'+
'      } '+
'} '+
' if(diffuse.x > 1.0) diffuse.x = 1.0;'+ //hardwire red if it goes too high 
' if(!basicDraw){ '+
' v_Color = vec4(diffuse+ambient+specular,u_Color.a); \n'+ //Id + Ia + Is, alpha value identifies a certain object
' } else v_Color = u_Color;'+ //draw with basic defined color, no lighting (use this for things like point light object); 
'}\n';

//Fragment shader for coloring 
var fragSource =
'precision mediump float; \n'+
'varying vec4 v_Color; \n'+
'void main(){ \n'+
' gl_FragColor = v_Color;\n'+
'}\n';

var Object_Array = []; //Array of SORs 

var pixel_color = 0; // result of mouse click
var object_selected = -1;
var alpha  = 0.99; //alpha value, decrements as a new object is created
var pointl = false; //toggle for point light
var directional = true; //toggle for directional light
var Lmouse_down=0;
var Mmouse_down=0;
var Rmouse_down=0;

var ViewMat_x = 0.0; ViewMat_y = 0.0; ViewMat_z = 450.0; 
var fov = 96.0;
function main(){
	//
	// STEP 1: SETTING UP WEBGL CONTEXT,
	// copying shaders to the webgl context and creating a glsl program

	
	var canvas = document.getElementById('canvas');
	var create_button = document.getElementById('b1');
	var load_button = document.getElementById('b2');
	var input_button = document.getElementById('fileinput');
	var toggleS_button = document.getElementById('b3');
	var toggleL_button = document.getElementById('b4');
	var toggleN_button = document.getElementById('b5');
	var gloss_slider    = document.getElementById('Gloss');
	var toggleP_button = document.getElementById('b6');
	var toggleD_button = document.getElementById('b7');
	var change_view    = document.getElementById('b8');
	var deselect_button = document.getElementById('b9');
	
	var gl = canvas.getContext('webgl');
	if(!gl){
		alert('Failed to get context for webgl');
	}
	
	//initialize shaders
	var vertexShader = gl.createShader(gl.VERTEX_SHADER);
	var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

	//send over vertex and fragment shader source code above to gl context
	gl.shaderSource(vertexShader, vertexSource);
	gl.shaderSource(fragmentShader, fragSource);
	
	//compile shader source code
	gl.compileShader(vertexShader);
	if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
		console.error("ERROR compiling vertex shader", gl.getShaderInfoLog(vertexShader));
		return;
	}
	gl.compileShader(fragmentShader);
	if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
		console.error("ERROR compiling fragment shader", gl.getShaderInfoLog(fragmentShader));
		return;
	}
	
	//link program and check for errors
	var program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
		console.error('ERROR linking program', gl.getProgramInfoLog(program));
		return;
	}
	gl.validateProgram(program);
	if(!gl.getProgramParameter(program, gl.VALIDATE_STATUS)){
		console.error('ERROR validating program', gl.getProgramInfoLogprogram);
		return;
	}
	
	gl.useProgram(program);
	
	//
	//STEP 2: SETUP COMPLETE, 
	//we can now interface with glsl through the variable, gl and program.
	
	//clear canvas color to white
	gl.clearColor(1.0,1.0,1.0,1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.enable(gl.DEPTH_TEST);
	
	
	var orthoMat = new Matrix4();
	orthoMat.setOrtho(-500.0, 500.0, -500.0, 500.0, -900.0, 900.0);
	var u_orthoMat = gl.getUniformLocation(program, 'u_orthoMat');
	gl.uniformMatrix4fv(u_orthoMat, false, orthoMat.elements);
	
	var ViewMat = new Matrix4(); 
	ViewMat.setLookAt(0,0,450, 0,0,-5.0, 0,1,0); 
	//ViewMat.setIdentity();
	var u_viewMat = gl.getUniformLocation(program, 'u_viewMat'); 
	gl.uniformMatrix4fv(u_viewMat, false, ViewMat.elements);
	
	//var PerspMat = new Matrix4(); 
	//PerspMat.setPerspective(40, 1, 10, 2000);
	//gl.uniformMatrix4fv(u_orthoMat, false, PerspMat.elements);
	
	var composite_Matrix = new Matrix4();
    composite_Matrix.setIdentity();	
	var u_CompositeM = gl.getUniformLocation(program, 'u_CompositeM');
	gl.uniformMatrix4fv(u_CompositeM, false, composite_Matrix.elements);
	
	//NEW IMPLEMENTATION- SHADER LIGHTING CALCULATION
	var u_Directional_Light_Color     = gl.getUniformLocation(program, 'u_Directional_Light_Color'); 
	var u_Directional_Light_Direction = gl.getUniformLocation(program, 'u_Directional_Light_Direction');
	var u_Point_Light_Color           = gl.getUniformLocation(program, 'u_Point_Light_Color');
	var u_Point_Light_Location        = gl.getUniformLocation(program, 'u_Point_Light_Location');
	var u_Specular_Light_Color        = gl.getUniformLocation(program, 'u_Specular_Light_Color');
	var u_glossiness                  = gl.getUniformLocation(program, 'u_glossiness');
	var u_Color                       = gl.getUniformLocation(program, 'u_Color'); 
	var DirectionalLight_on           = gl.getUniformLocation(program, 'DirectionalLight_on'); 
	var PointLight_on                 = gl.getUniformLocation(program, 'PointLight_on');
	var Specular_on                   = gl.getUniformLocation(program, 'Specular_on');
	var View_From                     = gl.getUniformLocation(program, 'u_View_From');
	
	
	gl.uniform3f(u_Directional_Light_Color, 1.0, 1.0, 1.0); gl.uniform3f(u_Point_Light_Color, 1.0, 1.0, 0.0);  
	gl.uniform3f(u_Specular_Light_Color, 0.0, 1.0, 0.0);
	var lightDirection = new Vector3([1.0, 1.0, 1.0]); 
	var pl_Locatioin   = new Vector4([0.0, 500.0, 0.0, 0.0]);
	var red            = new Vector4([1.0, 0.0, 0.0, 1.0]);
	var view_from      = new Vector3([0.0, 0.0, 1.0]);
	lightDirection.normalize(); 
	gl.uniform3fv(u_Directional_Light_Direction, lightDirection.elements);
	gl.uniform4fv(u_Point_Light_Location, pl_Locatioin.elements);
	gl.uniform4fv(u_Color, red.elements);
	gl.uniform3fv(View_From, view_from.elements);
	gl.uniform1f(DirectionalLight_on,1); gl.uniform1f(PointLight_on,0);
	gl.uniform1f(u_glossiness,4.0);
	
	var on = false; //toggle for smoothness
	var on_normals = false; // toggle for normals
	var Spec = false;
	var view = false;
	var cur_x=0; cur_y=0;
	
	setupIOSOR('fileinput');
	var drawable = false; //does user want to draw?
	
	drawObjects(on, on_normals, gl, program, 0,0);
	load_button.onclick = function(ev){drawable=false;renderFile(gl,program,canvas,'a_Position'); on =true;on_normals=true;Spec=false};
	
	toggleS_button.onclick = function(ev){drawable=false;on = !on; drawObjects(on, on_normals, gl, program,0,0);};
	
	toggleL_button.onclick = function(ev){drawable=false;Spec = !Spec; 
	                                      gl.uniform1f(Specular_on,Spec);drawObjects(on, on_normals, gl, program,0,0);}; //Toggle Specular

	toggleP_button.onclick = function(ev){drawable=false;pointl = !pointl;
	                                      gl.uniform1f(PointLight_on,pointl);drawObjects(on, on_normals, gl, program,0,0);};
										  
	toggleD_button.onclick = function(ev){drawable=false;directional = !directional;
	                                      gl.uniform1f(DirectionalLight_on, directional);drawObjects(on, on_normals, gl, program,0,0);};

	gloss_slider.onchange  = function(ev){gl.uniform1f(u_glossiness, gloss_slider.value);drawObjects(on, on_normals, gl, program,0,0);};
	toggleN_button.onclick = function(ev){drawable=false;on_normals = !on_normals;drawObjects(on, on_normals, gl, program,0,0);};
	change_view.onclick = function(ev){drawable=false; view = !view;  
										var u_viewMat = gl.getUniformLocation(program, 'u_viewMat'); 
										 var PerspMat = new Matrix4();
	                                   if(view == true){ PerspMat.setPerspective(fov, 1, 10, 2000);
									                     gl.uniformMatrix4fv(u_orthoMat, false, PerspMat.elements)}
									   if(view == false) { gl.uniformMatrix4fv(u_orthoMat, false, orthoMat.elements);}
									    
										   drawObjects(on, on_normals, gl, program,0,0);};
	create_button.onclick = function(ev){;drawable = true; gl.clear(gl.COLOR_BUFFER_BIT);
	                                     alert('right click when done drawing, this will save the file.');
										  closed_curve_points=[];
										  face_indices= [];								
										  flat_normals=[];smooth_normals=[]; n_lines=[];
										  canvas_points = []; 
										  left_click_points = [];
										  right_click_points = [];
										  on=true;on_normals=true;Spec=false;};
										  
     deselect_button.onclick = function(ev) { object_selected = -1;}
	 var I = new Matrix4(); I.setIdentity();
	canvas.onmousedown = function(ev){
		if(ev.button == 0) Lmouse_down = 1;
		if(ev.button == 1) Mmouse_down = 1;
		if(ev.button == 2) Rmouse_down = 1;
		//console.log("md"+mouse_down);
		var x = ev.clientX; y = ev.clientY;
		   var rect = ev.target.getBoundingClientRect();
		   if(rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom){
			
			var x_in_canvas = x - rect.left; y_in_canvas = rect.bottom - y;
		   cur_x = x_in_canvas; cur_y = y_in_canvas;}
		if(!drawable){
	     
		 if(ev.button == 0 && object_selected == -1){  // user is trying to select an object 
		   var x = ev.clientX; y = ev.clientY;
		   var rect = ev.target.getBoundingClientRect();
		   if(rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom){
			
			var x_in_canvas = x - rect.left; y_in_canvas = rect.bottom - y;  
			
			gl.clear(gl.COLOR_BUFFER_BIT);
			var pix_color = drawObjects(on, on_normals, gl, program,x_in_canvas,y_in_canvas);
			pixel_color = pix_color; 
			if( pix_color != "yellow" && pix_color != "red" && pix_color !="white"){
			alpha_val = pix_color;
			var obj_index = -( (alpha_val/255) - 0.99) / 0.02 ;
			if(obj_index >= 0)
			alert("you picked object: "+ Math.floor(obj_index) + ", to unselect, click the deselect button or white space "); Lmouse_down--;
			object_selected = Math.floor(obj_index);
			return;
			
			}
		}
		} if(ev.button == 0 && object_selected != -1) { gl.clear(gl.COLOR_BUFFER_BIT);
			var pix_color = drawObjects(on, on_normals, gl, program,x_in_canvas,y_in_canvas);
			pixel_color = pix_color; 
			return;
			}
		
		 if(ev.button == 2 && object_selected != 1) {  drawObjects(on, on_normals, gl, program,x_in_canvas,y_in_canvas); return;
			
			} // 
		}
		if(drawable){
		if(ev.button == 0){ //on left click
		placePoint(ev,gl,program,canvas, 'a_Position');
		
		}
		if(ev.button == 2){ //on right click
		drawable = false;
	    create_GC(ev, gl, program, canvas);
		}
	}}; 
	canvas.onmouseup = function(ev){
		if(ev.button == 0) Lmouse_down = 0;
		if(ev.button == 1) Mmouse_down = 0;
		if(ev.button == 2) Rmouse_down = 0;
 		//console.log("md"+mouse_down);
		if(!drawable){
			if(pixel_color == "red") {directional = !directional; gl.clear(gl.COLOR_BUFFER_BIT);
			                           gl.uniform1f(DirectionalLight_on, directional);drawObjects(on, on_normals, gl, program,0,0);}
		    if(pixel_color == "yellow"){pointl = !pointl; gl.clear(gl.COLOR_BUFFER_BIT);
			                           gl.uniform1f(PointLight_on, pointl);drawObjects(on, on_normals, gl, program,0,0);}
			if(pixel_color == "white"){object_selected = -1; drawObjects(on, on_normals, gl, program,0,0);}
									   
            //else alpha was returned
			console.log(pixel_color);
			
			
		}
		
	}
	var moved_x = 0; moved_y=0;
	canvas.onmousemove = function(ev){if(drawable){rubberLine(ev,gl, program, canvas, 'a_Position');}
	 var x = ev.clientX; y = ev.clientY;
		   var rect = ev.target.getBoundingClientRect();
		   if(rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom){
			
			var x_in_canvas = x - rect.left; y_in_canvas = rect.bottom - y;
		   moved_x = x_in_canvas; moved_y = y_in_canvas;}
	 if(!drawable && Lmouse_down==1 && object_selected != -1){ console.log("translating"+ object_selected);
	 
			var delta_x = moved_x - cur_x; var delta_y = moved_y - cur_y; 
			
			Object_Array[object_selected].avgX += 0; Object_Array[object_selected].avgY += 0;
			cur_x = moved_x; cur_y = moved_y;
			console.log("deltax: "+ delta_x + ",deltay"+ delta_y);
			console.log("avgx:" + Object_Array[object_selected].avgX); console.log("avgy:" + Object_Array[object_selected].avgY)
			var this_obj = Object_Array[object_selected];
			var trans = new Matrix4(); trans.setTranslate(delta_x/500, delta_y/500, 0);
			Object_Array[object_selected].Trans_Mat.translate(delta_x, delta_y, 0);
			drawObjects(on, on_normals, gl, program,x_in_canvas,y_in_canvas);
	 
	 
	 }
     
	 if( !drawable && Lmouse_down==1 && object_selected == -1) { console.log("panning"); 
	            var delta_x = moved_x - cur_x; var delta_y = moved_y - cur_y; 
				
				ViewMat_x += delta_x; ViewMat_y += delta_y;
				var newViewM = new Matrix4(); 
				newViewM.setLookAt(ViewMat_x/150, ViewMat_y/150, ViewMat_z, ViewMat_x/150,ViewMat_y/150,-0.5, 0,1,0);
				gl.uniformMatrix4fv(u_viewMat, false, newViewM.elements);
				drawObjects(on, on_normals, gl, program,x_in_canvas,y_in_canvas);
	 }
				
	 
	 if(!drawable && Rmouse_down==1 && object_selected != -1){ console.log("rotating"+ object_selected);
	 
			  var delta_x = moved_x - cur_x; var delta_y = moved_y - cur_y; 
			  cur_x = moved_x; cur_y = moved_y;
			  if(Math.abs(delta_x) > Math.abs(delta_y)){ console.log("rotating about z");
				var this_obj = Object_Array[object_selected]; 
				var ang; 
				if(delta_x > 0) ang = -3; else ang = 3;
				
				Object_Array[object_selected].Rot_Mat.rotate(ang,0,0,1);
				
				drawObjects(on, on_normals, gl, program,0,0);
				
			  
			  }
			  else{ console.log("rotating about x");
				var ang; 
				if(delta_y > 0) ang = -3; else ang = 3;  
				
				Object_Array[object_selected].Rot_Mat.rotate(ang,1,0,0);
				
				drawObjects(on, on_normals, gl, program,0,0);
			  }
	 }
	};
	
	canvas.onmousewheel = function(ev){ 
	
				if(!drawable && object_selected != -1 && Mmouse_down == 0){ 
	            	var wheel = event.wheelDelta/120;
					console.log(wheel);
					var this_obj = Object_Array[object_selected]; 
					var this_avgX = this_obj.avgX; var this_avgY = this_obj.avgY; var scale= 0;
					if( wheel > 0) scale = 1.1; else scale = 0.9;
					Object_Array[object_selected].Scale_Mat.scale(scale,scale,scale);
					drawObjects(on, on_normals, gl, program,0,0);
					return false;
				}
				
				if(!drawable && Mmouse_down==1 && object_selected == -1){ console.log("moving in/out"); 
					var delta_z = event.wheelDelta/120;
					ViewMat_z -= delta_z*10;
					var newViewM = new Matrix4(); 
					newViewM.setLookAt(ViewMat_x/150, ViewMat_y/150, ViewMat_z, ViewMat_x/150,ViewMat_y/150,-0.5, 0,1,0);
					gl.uniformMatrix4fv(u_viewMat, false, newViewM.elements);
					drawObjects(on, on_normals, gl, program,0,0);
					return false;
				}
				if(!drawable && object_selected == -1 && view != false) {console.log("changing FOV");
					var delta_z = event.wheelDelta/120;
					fov += delta_z;
					console.log( delta_z);
					var newPersp = new Matrix4(); 
					newPersp.setPerspective(fov, 1, 10, 2000);
					gl.uniformMatrix4fv(u_orthoMat, false, newPersp.elements);
					drawObjects(on, on_normals, gl, program,0,0);
					return false;
				 
				 
				}
				
				if(!drawable && Mmouse_down==1 && object_selected != -1){ console.log("translating"+ object_selected);
	  
					var delta_z = event.wheelDelta/120;
					var trans = new Matrix4(); trans.setTranslate(0, 0, delta_z/500);
					Object_Array[object_selected].Trans_Mat.translate(0, 0, delta_z*10);
					drawObjects(on, on_normals, gl, program,0,0);
					return false;
	 
	 }
	
	}

}

var canvas_points = []; //array to hold point coordinates in webgl form (-1 to 1) 
var left_click_points = [];
var right_click_points = [];

function placePoint(ev, gl, prog, canvas, a_Position){
	//get global mouse point
	var x = ev.clientX;
	var y = ev.clientY;
	console.log('left-click:'+ x + ', '+ y);
	left_click_points.push(x); left_click_points.push(y);
	var rectangle = ev.target.getBoundingClientRect(); //get dimensions of the canvas
	
	//get x and y in webgl standard form (-1 to 1)
	x = ((x - rectangle.left)-(canvas.width/2))/(canvas.width/2);
	y = ((canvas.height/2)-(y-rectangle.top))/(canvas.height/2);
	canvas_points.push(x*500); canvas_points.push(y*500);
	
	//create a buffer
	var len = canvas_points.length;
	var vertices = new Float32Array(canvas_points);
	if(!initializeArrayBuf(gl, prog, vertices, 2, gl.FLOAT, a_Position)){return -1;};
	gl.clear(gl.COLOR_BUFFER_BIT); //clear color buffer so we don't overwrite the color of the canvas
	gl.drawArrays(gl.LINE_STRIP, 0, (canvas_points.length)/2);
	
	
}

//almost the same of placePoint but pop the point off the array after the draw
function rubberLine(ev, gl, prog, canvas, a_Position){
	
	var x = ev.clientX;
	var y = ev.clientY;
	
	var rectangle = ev.target.getBoundingClientRect();
	
	x = ((x - rectangle.left)-(canvas.width/2))/(canvas.width/2);
	y = ((canvas.height/2)-(y-rectangle.top))/(canvas.height/2);
	canvas_points.push(x*500); canvas_points.push(y*500);
	
	var len = canvas_points.length;
	var vertices = new Float32Array(canvas_points);
	if(!initializeArrayBuf(gl, prog, vertices, 2, gl.FLOAT, a_Position)){return -1;};
	gl.clear(gl.COLOR_BUFFER_BIT); 
	gl.drawArrays(gl.LINE_STRIP, 0, (canvas_points.length)/2);
	
	canvas_points.pop(); canvas_points.pop(); 
	
}


var closed_curve_points=[];
var face_indices= [];
var flat_normals=[]; //remember to normalize 
var smooth_normals=[];
var n_lines=[]; 
var radius = 60; 
var total_x = 0; 
var total_y = 0; //these will be used later for rotating/scaling in place, On translate, update these vals.
var x_count = 0; y_count = 0;
function create_GC(ev, gl, prog, canvas){
	
	if(canvas_points.length < 4){ alert("you must form 2 or more points"); gl.clear(gl.COLOR_BUFFER_BIT); return;}
	
	var surface_Color = gl.getUniformLocation(prog, 'u_Color');
	var red           = new Vector4([1.0, 1.0, 0.0, alpha]);
	
	var rotMat = new Matrix4();
	var rotMat2 = new Matrix4();
	var transMat = new Matrix4();
	var transMat2 = new Matrix4();
	var transMat3 = new Matrix4();
	var transHinge1 = new Matrix4();
	var transHinge2 = new Matrix4();
        
	
	for(var x = 0; x < canvas_points.length-2 ; x+=2){
		var start_point = new Vector4([canvas_points[x] , canvas_points[x+1], -radius,1]);
		var hinge_point;
		var hinge = false;
		transMat.setTranslate(-canvas_points[x], -canvas_points[x+1],0); // bring to origin
	    transMat2.setTranslate(canvas_points[x], canvas_points[x+1], 0); // push back to first point
		transMat3.setTranslate(canvas_points[x+2], canvas_points[x+3], 0); // push back to next point
		//transHinge2.setTranslate(canvas_points[x+4], canvas_points[x+5], 0);
		if(x+2 < canvas_points.length-2){
			hinge_point = new Vector4([canvas_points[x+2], canvas_points[x+3], -radius, 1]);
			hinge = true;
		}
		var delta_y = canvas_points[x+3] - canvas_points[x+1]; delta_x = canvas_points[x+2] - canvas_points[x];
		var hdelta_y; var hdelta_x;
		if(hinge) {
			hdelta_y = canvas_points[x+5] - canvas_points[x+3]; hdelta_x = canvas_points[x+4] - canvas_points[x+2];
			transHinge1.setTranslate(-canvas_points[x+2], -canvas_points[x+3], 0);
			transHinge2.setTranslate(canvas_points[x+2], canvas_points[x+3], 0);
			
		}
		
		var Pi = transMat.multiplyVector4(start_point); //initial point at origin coming out of screen
		var Phi;
		if(hinge) Phi = transHinge1.multiplyVector4(hinge_point); 
		//loop to push polygon vertices, each iteration creates one polygon
        for(var i = 0; i < 12; i++){
			var angle1 = i*30;
			var angle2 = angle1 + 30;
			rotMat.setRotate(angle1,delta_x,delta_y,0);
			rotMat2.setRotate(angle2,delta_x,delta_y,0);
			P0_origin = rotMat.multiplyVector4(Pi);
			P1_origin = rotMat2.multiplyVector4(Pi);

			P0 = transMat2.multiplyVector4(P0_origin); // points that make up polygon face
			P1 = transMat2.multiplyVector4(P1_origin);
			P2 = transMat3.multiplyVector4(P1_origin);
			P3 = transMat3.multiplyVector4(P0_origin);
			//P1 - P0 and P2 - P1
			v1_x = P1.elements[0] - P0.elements[0]; v1_y = P1.elements[1] - P0.elements[1]; v1_z = P1.elements[2] - P0.elements[2]; 
			v2_x = P2.elements[0] - P1.elements[0]; v2_y = P2.elements[1] - P1.elements[1]; v2_z = P2.elements[2] - P1.elements[2]; 
			//v1 X v2 
			cross_x = (v1_y*v2_z - v1_z*v2_y); cross_y = -(v1_x*v2_z - v1_z*v2_x); cross_z = (v1_x*v2_y - v1_y*v2_x);
			magnitude = (Math.sqrt( (cross_x*cross_x) + (cross_y*cross_y) + (cross_z*cross_z)) );
			norm_x = cross_x/magnitude; norm_y = cross_y/magnitude; norm_z = cross_z/magnitude;
			
			closed_curve_points.push(P0.elements[0], P0.elements[1], P0.elements[2]); //first point
			closed_curve_points.push(P1.elements[0], P1.elements[1], P1.elements[2]); //second point 
			closed_curve_points.push(P2.elements[0], P2.elements[1], P2.elements[2]); //third point
			closed_curve_points.push(P3.elements[0], P3.elements[1], P3.elements[2]); //fourth point 
			total_x += P0.elements[0]/500 + P1.elements[0]/500 + P2.elements[0]/500 + P3.elements[0]/500;
			x_count += 4; y_count += 4;
			total_y += P0.elements[1]/500 + P1.elements[1]/500 + P2.elements[1]/500 + P3.elements[1]/500;
			n_lines.push(P0.elements[0], P0.elements[1], P0.elements[2], (norm_x*50)+P0.elements[0], (norm_y*50)+P0.elements[1], (norm_z*50)+P0.elements[2]);
			for(var q = 0 ; q < 4; q++){flat_normals.push(cross_x, cross_y, cross_z);}
			
			if(hinge){
				rotMat.setRotate(angle1, hdelta_x, hdelta_y, 0);
				rotMat2.setRotate(angle2, hdelta_x, hdelta_y, 0);
				P0_h_origin = rotMat.multiplyVector4(Phi);
				P1_h_origin = rotMat2.multiplyVector4(Phi);
				
				P0_h = transHinge2.multiplyVector4(P0_h_origin);
				P1_h = transHinge2.multiplyVector4(P1_h_origin);
				//P3-P2 && P0_h - P2
				v1_x = P3.elements[0] - P2.elements[0]; v1_y = P3.elements[1] - P2.elements[1]; v1_z = P3.elements[2] - P2.elements[2]; 
				v2_x = P0_h.elements[0] - P2.elements[0]; v2_y = P0_h.elements[1] - P2.elements[1]; v2_z = P0_h.elements[2] - P2.elements[2]; 
				//v1 X v2 
				//try attaching first 
				closed_curve_points.push(P3.elements[0], P3.elements[1], P3.elements[2]); //first point
				closed_curve_points.push(P2.elements[0], P2.elements[1], P2.elements[2]); //second point 
				closed_curve_points.push(P1_h.elements[0], P1_h.elements[1], P1_h.elements[2]); //third point
				closed_curve_points.push(P0_h.elements[0], P0_h.elements[1], P0_h.elements[2]); //fourth point 
			
			   for(var q = 0 ; q < 4; q++){ flat_normals.push(cross_x, cross_y, cross_z);}
			}
			
		}
		
	}
		
		var averageX = total_x/x_count; 
		var averageY = total_y/y_count; 
		console.log("Avgx is:"+ averageX+ "Avgy is:+"+ averageY);
		total_x = 0; total_y = 0; x_count = 0; y_count = 0;
		
		//draw indices
		var total_vertices = (closed_curve_points.length/3);
		for(var i = 0; i < total_vertices ; i+=4){

			face_indices.push(i, i+1, i+2); //first half of quad face 
			face_indices.push(i+2,i+3, i); //second half
		}
		smooth_normals = getSmoothNormals(); //makes use of closed_curve_points
		var GC = new SOR("GC", closed_curve_points, face_indices);
		var obj_alpha = 255*(0.99 - (0.02 * Object_Array.length));
		console.log("estimated alpha is:"+ obj_alpha);
		Object_Array.push(new object(GC, flat_normals, smooth_normals, n_lines, averageX, averageY));
		console.log(Object_Array);
		drawObjects(true, false, gl, prog, 0, 0); //flat, point light enabled, directional enabled, sepcular enabled, spec val.
		saveFile(GC);
		
	
}

function renderFile(gl, prog, canvas, a_Position){
	var x_total=0; y_total=0; x_count=0; y_count=0;
	var flat_normals=[];
	var smooth_normals=[];
	var n_lines=[];
	newSOR = readFile();
	
	if(!newSOR){return;}
	
    closed_curve_points = newSOR.vertices;
	for(var x = 0; x < closed_curve_points.length ; x+=12)
	{
	    P0_x = closed_curve_points[x]; P0_y = closed_curve_points[x+1]; P0_z = closed_curve_points[x+2];
		P1_x = closed_curve_points[x+3]; P1_y = closed_curve_points[x+4]; P1_z = closed_curve_points[x+5];
		P2_x = closed_curve_points[x+6]; P2_y = closed_curve_points[x+7]; P2_z = closed_curve_points[x+8];
		P3_x = closed_curve_points[x+9]; P3_y = closed_curve_points[x+10];
		v1_x = P1_x - P0_x; v1_y = P1_y - P0_y; v1_z = P1_z - P0_z; 
		v2_x = P2_x - P1_x; v2_y = P2_y - P1_y; v2_z = P2_z - P1_z;
		cross_x = (v1_y*v2_z - v1_z*v2_y); cross_y = -(v1_x*v2_z - v1_z*v2_x); cross_z = (v1_x*v2_y - v1_y*v2_x);
		magnitude = (Math.sqrt( (cross_x*cross_x) + (cross_y*cross_y) + (cross_z*cross_z)) );
		norm_x = cross_x/magnitude; norm_y = cross_y/magnitude; norm_z = cross_z/magnitude;
		n_lines.push(P0_x, P0_y, P0_z, P0_x+(norm_x*50), P0_y+(norm_y*50), P0_z+(norm_z*50));
		for(var j=0; j < 4; j++)flat_normals.push(cross_x, cross_y, cross_z);
		x_total += P0_x/500 + P1_x/500 + P2_x/500 + P3_x/500; y_total += P0_y/500 + P1_y/500 + P2_y/500 + P3_y/500; x_count += 4; y_count += 4;
	}
	var averageX = x_total/x_count; averageY = y_total/y_count;
	smooth_normals = getSmoothNormals();
	Object_Array.push(new object(newSOR, flat_normals, smooth_normals, n_lines, averageX, averageY));
	drawObjects(true, false, gl, prog, 0 ,0);
	
	
}

function drawObjects(flat, on_normals, gl, prog, x_can, y_can){
	var combined_vertices=[];
	var combined_indices=[]; 
	var combined_normals=[]; 
	var combined_normal_lines=[];
	gl.clear(gl.COLOR_BUFFER_BIT);
	console.log("Obj Len"+ Object_Array.length);
	var indexBuffer = gl.createBuffer();
	for(var x=0; x < Object_Array.length; x++){
		var surface_Color = gl.getUniformLocation(prog, 'u_Color');
		var red               = new Vector4([1.0, 0.0, 0.0, alpha]);
		gl.uniform4fv(surface_Color, red.elements);
		console.log("alpha before dec:" +alpha);
		alpha -= 0.02;
		console.log(combined_vertices.length);console.log(combined_indices.length); console.log(combined_normals.length);
		Package = Object_Array[x];
		Obj = Package.SOR; 
		if(Obj.objName == "GC"){ 
		var next_index = (combined_vertices.length/3);
		console.log("next_index: " + next_index);
			combined_vertices = Obj.vertices;
			combined_normal_lines = Package.normal_lines;
			combined_indices = Obj.indexes; 
			console.log(combined_indices.length);
			if(flat == true)  combined_normals = Package.flat_norms; //if flat is on, else do smooth
			else{ combined_normals = Package.smooth_norms;}
			
		}
		
	
	var rot_Matrix = Package.Rot_Mat; 
	var scale_Matrix = Package.Scale_Mat; 
	var trans_origin = Package.Trans_origin;
	var trans_back   = Package.Trans_back; 
	var transM       = Package.Trans_Mat; 
	
	var u_RotM = gl.getUniformLocation(prog, 'u_Rot_Mat');
	gl.uniformMatrix4fv(u_RotM, false, rot_Matrix.elements);
	var u_ScaleM = gl.getUniformLocation(prog, 'u_Scale_Mat');
	gl.uniformMatrix4fv(u_ScaleM, false, scale_Matrix.elements);
	var u_transM = gl.getUniformLocation(prog, 'u_TransM');
	gl.uniformMatrix4fv(u_transM, false, transM.elements);
	var u_Trans_o = gl.getUniformLocation(prog, 'u_Trans_OriginM');
	gl.uniformMatrix4fv(u_Trans_o, false, trans_origin.elements);
	var u_Trans_back = gl.getUniformLocation(prog, 'u_Trans_BackM');
	gl.uniformMatrix4fv(u_Trans_back, false, trans_back.elements);
	
	var inverse_transpose = new Matrix4();
	inverse_transpose.set(rot_Matrix);
    (inverse_transpose.transpose()).invert();
	var u_inverseTranspose = gl.getUniformLocation(prog, 'u_inverseTranspose'); 
	gl.uniformMatrix4fv(u_inverseTranspose, false, inverse_transpose.elements);
	var u_basicDraw           = gl.getUniformLocation(prog, 'basicDraw');
	if(Object_Array.length > 0){
	gl.uniform1f(u_basicDraw, 0); 
	var final_vertices = new Float32Array(combined_vertices);
	if(!initializeArrayBuf(gl, prog, final_vertices, 3, gl.FLOAT, 'a_Position')){return -1;};
	var final_normals = new Float32Array(combined_normals);
	if(!initializeArrayBuf(gl, prog, final_normals, 3, gl.FLOAT, 'a_Normal')){return -1;};
	
	
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
		var indices = new Uint16Array(combined_indices);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
	gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0); }
	 //PROBLEM WAS CLEARING THE BUFFER TOO EARLY
		
	if(on_normals){
		var final_norm_lines = new Float32Array(combined_normal_lines); 
		if(!initializeArrayBuf(gl, prog, final_norm_lines, 3, gl.FLOAT, 'a_Position')){return -1;};
		gl.drawArrays(gl.LINES, 0, final_norm_lines.length/3);
		
}}
	
	//trans_back, Rot, Scale, trans_origin, trans
	var trans_back = new Matrix4();  trans_back.setIdentity();
	var Rot_Mat    = new Matrix4();  Rot_Mat.setIdentity(); 
	var Scale_Mat  = new Matrix4();  Scale_Mat.setIdentity();
	var trans_O    = new Matrix4();  trans_O.setIdentity(); 
	var trans_Mat  = new Matrix4();  trans_Mat.setIdentity();
	
	var u_trans_backM = gl.getUniformLocation(prog, 'u_Trans_BackM');
	gl.uniformMatrix4fv(u_trans_backM, false, trans_back.elements);
	var u_RotM = gl.getUniformLocation(prog, 'u_Rot_Mat');
	gl.uniformMatrix4fv(u_RotM, false, Rot_Mat.elements);
	var u_ScaleM = gl.getUniformLocation(prog, 'u_Scale_Mat');
	gl.uniformMatrix4fv(u_ScaleM, false, Scale_Mat.elements);
	var u_trans_O = gl.getUniformLocation(prog, 'u_Trans_OriginM');
	gl.uniformMatrix4fv(u_trans_O, false, trans_O.elements);
	var u_trans = gl.getUniformLocation(prog, 'u_TransM');
	gl.uniformMatrix4fv(u_trans, false, trans_Mat.elements);
	
	var surface_Color = gl.getUniformLocation(prog, 'u_Color');
	var yellow            = new Vector4([1.0, 1.0, 0.0, 1.0]);
	var red               = new Vector4([1.0, 0.0, 0.0, 1.0]);
	gl.uniform4fv(surface_Color, yellow.elements);
	
	gl.uniform1f(u_basicDraw,1)
	var pointL_vertices1 =[-50.0, 450.0, 0.0,  50.0, 450.0,0.0,  0.0, 530.0,0.0];
	var pointL_vertices = new Float32Array(pointL_vertices1);
	var pointL_indices1  = [0, 1, 2]; 
	var pointL_indices = new Uint16Array(pointL_indices1);
	var Direction_vertices1 = [250.0,250.0,0.0, 450.0, 450.0, 0.0, 490.0, 450, 0.0];
	var Direction_vertices  = new Float32Array(Direction_vertices1); 
	var Direction_indices1  = [0, 1, 2]; 
	var Direction_indices   = new Uint16Array(Direction_indices1);
	if(!initializeArrayBuf(gl, prog, pointL_vertices, 3, gl.FLOAT, 'a_Position')){return -1;};
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
		var indices = new Uint16Array(pointL_indices);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
		gl.drawElements(gl.TRIANGLES, pointL_indices.length, gl.UNSIGNED_SHORT, 0);
	gl.uniform4fv(surface_Color, red.elements);
	if(!initializeArrayBuf(gl, prog, Direction_vertices, 3, gl.FLOAT, 'a_Position')){return -1;};
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
		var indices = new Uint16Array(Direction_indices);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
		gl.drawElements(gl.TRIANGLES, Direction_indices.length, gl.UNSIGNED_SHORT, 0);
		alpha = 0.99;
	if( x_can != 0 && y_can != 0){
		var pixels = new Uint8Array(4);
			gl.readPixels(x_can, y_can,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels); 
			console.log(pixels); 
			if(pixels[0] == 255 && pixels[1] == 0) return "red";
			if(pixels[0] == 255 && pixels[1] ==255 && pixels[2] == 0) return "yellow";
			if(pixels[0] == 255 && pixels[1] ==255 && pixels[2] == 255) return "white";
			else return pixels[3]; //return alpha value
		
	} 
		
}

function getSmoothNormals(){
	var smoothNorms = [];
	
	var old_avg_x = null; old_avg_y=null; old_avg_z=null;
	for(var x = 0; x < closed_curve_points.length ; x+=24){
		    if(closed_curve_points.length - x == 144) {smoothNorms = smoothNorms.concat(get_last_cyl_norms(x)); break;}
			P0_x = closed_curve_points[x]; P0_y = closed_curve_points[x+1]; P0_z = closed_curve_points[x+2];
			P1_x = closed_curve_points[x+3]; P1_y = closed_curve_points[x+4]; P1_z = closed_curve_points[x+5];
			P2_x = closed_curve_points[x+6]; P2_y = closed_curve_points[x+7]; P2_z = closed_curve_points[x+8];
			P3_x = closed_curve_points[x+9]; P3_y = closed_curve_points[x+10]; P3_z = closed_curve_points[x+11];
			v1_x = P1_x - P0_x; v1_y = P1_y - P0_y; v1_z = P1_z - P0_z; 
			v2_x = P2_x - P1_x; v2_y = P2_y - P1_y; v2_z = P2_z - P1_z;
			cross_x = (v1_y*v2_z - v1_z*v2_y); cross_y = -(v1_x*v2_z - v1_z*v2_x); cross_z = (v1_x*v2_y - v1_y*v2_x);
			var magnitude = (Math.sqrt( (cross_x*cross_x) + (cross_y*cross_y) + (cross_z*cross_z)) );
			//normals of the surface
			var norm_x = cross_x/magnitude;var norm_y = cross_y/magnitude;var norm_z = cross_z/magnitude;
		
			var next_norm_x = 0; var next_norm_y = 0; var next_norm_z = 0;
			if(x+12 < closed_curve_points.length){
			next_P0_x = closed_curve_points[x+24]; next_P0_y = closed_curve_points[x+25]; next_P0_z = closed_curve_points[x+26];
			next_P1_x = closed_curve_points[x+27]; next_P1_y = closed_curve_points[x+28]; next_P1_z = closed_curve_points[x+29];
			next_P2_x = closed_curve_points[x+30]; next_P2_y = closed_curve_points[x+31]; next_P2_z = closed_curve_points[x+32];
			next_v1_x = next_P1_x - next_P0_x; next_v1_y = next_P1_y - next_P0_y; next_v1_z = next_P1_z - next_P0_z; 
			next_v2_x = next_P2_x - next_P1_x; next_v2_y = next_P2_y - next_P1_y; next_v2_z = next_P2_z - next_P1_z;
			next_cross_x = (next_v1_y*next_v2_z - next_v1_z*next_v2_y); next_cross_y = -(next_v1_x*next_v2_z - next_v1_z*next_v2_x); next_cross_z = (next_v1_x*next_v2_y - next_v1_y*next_v2_x);
			next_magnitude = (Math.sqrt( (next_cross_x*next_cross_x) + (next_cross_y*next_cross_y) + (next_cross_z*next_cross_z)) );
			//normals of the surface
			next_norm_x = next_cross_x/next_magnitude; next_norm_y = next_cross_y/next_magnitude; next_norm_z = next_cross_z/next_magnitude;
			}
			//console.log(next_norm_x);
			var avg_x = norm_x + next_norm_x; var avg_y = norm_y = norm_y + next_norm_y; var avg_z = norm_z + next_norm_z;
			magnituden = (Math.sqrt( (avg_x*avg_x) + (avg_y*avg_y) + (avg_z*avg_z)) );
			//normals of the surface
			avg_x = avg_x/magnituden; avg_y = avg_y/magnituden; avg_z = avg_z/magnituden;
			
			if(x == 0) {old_avg_x = norm_x; old_avg_y = norm_y; old_avg_z = norm_z;}
			//if(x == 0) {old_r = resulting_color_r; old_g = resulting_color_g; old_b = resulting_color_b;}
			//vertices from old iteration shouldnt change color
			smoothNorms.push(old_avg_x, old_avg_y, old_avg_z);
			smoothNorms.push(avg_x, avg_y, avg_z);
			smoothNorms.push(avg_x, avg_y, avg_z);
			smoothNorms.push(old_avg_x, old_avg_y, old_avg_z);
			
			smoothNorms.push(old_avg_x, old_avg_y, old_avg_z);
			smoothNorms.push(avg_x, avg_y, avg_z);
			smoothNorms.push(avg_x, avg_y, avg_z);
			smoothNorms.push(old_avg_x, old_avg_y, old_avg_z);
			
			old_avg_x = avg_x; old_avg_y = avg_y; old_avg_z = avg_z;
			
	}
	
	return smoothNorms;
	
}
function get_last_cyl_norms(i){
	var smoothyNorms=[];
	
	var old_avg_x = null; old_avg_y=null; old_avg_z=null;
	for(var x = i; x < closed_curve_points.length ; x+=12){
			P0_x = closed_curve_points[x]; P0_y = closed_curve_points[x+1]; P0_z = closed_curve_points[x+2];
			P1_x = closed_curve_points[x+3]; P1_y = closed_curve_points[x+4]; P1_z = closed_curve_points[x+5];
			P2_x = closed_curve_points[x+6]; P2_y = closed_curve_points[x+7]; P2_z = closed_curve_points[x+8];
			P3_x = closed_curve_points[x+9]; P3_y = closed_curve_points[x+10]; P3_z = closed_curve_points[x+11];
			v1_x = P1_x - P0_x; v1_y = P1_y - P0_y; v1_z = P1_z - P0_z; 
			v2_x = P2_x - P1_x; v2_y = P2_y - P1_y; v2_z = P2_z - P1_z;
			cross_x = (v1_y*v2_z - v1_z*v2_y); cross_y = -(v1_x*v2_z - v1_z*v2_x); cross_z = (v1_x*v2_y - v1_y*v2_x);
			var magnitude = (Math.sqrt( (cross_x*cross_x) + (cross_y*cross_y) + (cross_z*cross_z)) );
			//normals of the surface
			var norm_x = cross_x/magnitude;var norm_y = cross_y/magnitude;var norm_z = cross_z/magnitude;
			//average normals, if there is a next face forget about hinge for a second, try to get next poly norm
			//DONT WORRY ABOUT HINGE JUST take x+24, the next non hinge polygon and use the calcuated color for the hinge as well
			var next_norm_x = 0; var next_norm_y = 0; var next_norm_z = 0;
			if(x+12 < closed_curve_points.length){
			next_P0_x = closed_curve_points[x+12]; next_P0_y = closed_curve_points[x+13]; next_P0_z = closed_curve_points[x+14];
			next_P1_x = closed_curve_points[x+15]; next_P1_y = closed_curve_points[x+16]; next_P1_z = closed_curve_points[x+17];
			next_P2_x = closed_curve_points[x+18]; next_P2_y = closed_curve_points[x+19]; next_P2_z = closed_curve_points[x+20];
			next_v1_x = next_P1_x - next_P0_x; next_v1_y = next_P1_y - next_P0_y; next_v1_z = next_P1_z - next_P0_z; 
			next_v2_x = next_P2_x - next_P1_x; next_v2_y = next_P2_y - next_P1_y; next_v2_z = next_P2_z - next_P1_z;
			next_cross_x = (next_v1_y*next_v2_z - next_v1_z*next_v2_y); next_cross_y = -(next_v1_x*next_v2_z - next_v1_z*next_v2_x); next_cross_z = (next_v1_x*next_v2_y - next_v1_y*next_v2_x);
			next_magnitude = (Math.sqrt( (next_cross_x*next_cross_x) + (next_cross_y*next_cross_y) + (next_cross_z*next_cross_z)) );
			//normals of the surface
			next_norm_x = next_cross_x/next_magnitude; next_norm_y = next_cross_y/next_magnitude; next_norm_z = next_cross_z/next_magnitude;
			}
			//console.log(next_norm_x);
			var avg_x = norm_x + next_norm_x; var avg_y = norm_y = norm_y + next_norm_y; var avg_z = norm_z + next_norm_z;
			magnituden = (Math.sqrt( (avg_x*avg_x) + (avg_y*avg_y) + (avg_z*avg_z)) );
			//normals of the surface
			avg_x = avg_x/magnituden; avg_y = avg_y/magnituden; avg_z = avg_z/magnituden;
			
			if(x == i) {old_avg_x = norm_x; old_avg_y = norm_y; old_avg_z = norm_z;}
			smoothyNorms.push(old_avg_x, old_avg_y, old_avg_z);
			smoothyNorms.push(avg_x, avg_y, avg_z);
			smoothyNorms.push(avg_x, avg_y, avg_z);
			smoothyNorms.push(old_avg_x, old_avg_y, old_avg_z);
			
			old_avg_x = avg_x; old_avg_y = avg_y; old_avg_z = avg_z;
	}
	return smoothyNorms;
	
}
function object(SOR, flat_norms, smooth_norms, normal_lines, avgX, avgY){
	this.SOR = SOR; 
	this.flat_norms = flat_norms; this.smooth_norms = smooth_norms; this.normal_lines = normal_lines;
	this.avgX = avgX; this.avgY = avgY;  
	var identity = new Matrix4(); identity.setIdentity(); 
				
	this.Trans_origin = (new Matrix4()).setTranslate(-avgX*500, -avgY*500, 0);
	this.Trans_back   = (new Matrix4()).setTranslate(avgX*500, avgY*500, 0);
	this.Rot_Mat = (new Matrix4()).set(identity);
    this.Scale_Mat = (new Matrix4()).set(identity);
    this.Trans_Mat= (new Matrix4()).set(identity);  
	
}
function initializeArrayBuf(gl, program, data, num, type, attribute){
	
	var buffer = gl.createBuffer();
	
	//write data to buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	console.log(attribute);
	//have attribute point to buffer
	var a_attribute = gl.getAttribLocation(program, attribute);
	if(a_attribute < 0){
		console.log('failed to get attribute');
		return;
	}
	
	gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
	gl.enableVertexAttribArray(a_attribute);
	
	return true;
	
}

