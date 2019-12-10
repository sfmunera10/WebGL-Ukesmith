// this class is used to store the matrices to draw objects
// the time value is used to determine when the object is no longer needed because it moves behind the frame
// the type value is used to identify what the object is, i.e, box or cone
class Transformation_Node
{
  constructor(matrix, time, type, bounding_box, parameters) 
    { 
        this.matrix = matrix; 
        this.t = time;
        this.next = null;
        this.pre = null;
        this.type = type;
        this.bounding_box = bounding_box;
        if (parameters != undefined)
          this.parameters = parameters;
        else this.parameters = {};
    }

  object_type()
  {
    return this.type;
  }
  
  transform()
  {
    return this.matrix;
  }

  time()
  {
    return this.t;
  }

  get_bounding_box()
  {
    return this.bounding_box;
  }
}

// this class is used to store a sequence of transformation nodes, and is similar to a queue in that
// the first item pushed onto the list will be the first item popped off the list
// it has an iterator method called next() that returns the next item in the list each time it is called
// the pop method is used to prevent the list from becoming too huge and is designed to remove items that 
// are behind the camera, which can be identified by examining their time value

// to iterate through all items, use 
//        for (var i = 0; i < this.list.length(); i++)
//          let temp = this.list.next();
//          if (some_condition)
//             list.pop()
class Matrix_List { 
    constructor() 
    { 
        this.head = null;
        this.tail = null;
        this.size = 0; 
        this.cur = null;
    }

    length()
    {
      return this.size;
    }

    next()
    {
      if (this.size == 0)
        return;
      let temp = this.cur;
      if (this.cur == this.tail)
        this.cur = this.head;
      else this.cur = this.cur.next;
      return temp;
    }

    get_current_node()
    {
      if (this.size == 0)
        return;
      return this.cur;
    }

    advance_node()
    {
      if (this.size == 0)
        return;
      if (this.cur == this.tail)
        this.cur = this.head;
      else this.cur = this.cur.next;
    }

    replace_node(element, time, type, bounding_box, parameters)
    {
      if (this.size == 0)
        return;
        var node = new Transformation_Node(element, time, type, bounding_box, parameters);
        if (this.cur != this.head)
        {
          node.pre = this.cur.pre;
          node.pre.next = node;
        }
        else this.head = node;
        if (this.cur != this.tail)
        {
          node.next = this.cur.next;
          node.next.pre = node;
        }
        else this.tail = node;
        this.cur = node;
    }
    reset_pointer()
    {
      this.cur = this.head;
    }

    push(element, time, type, bounding_box, parameters) 
    { 
     var node = new Transformation_Node(element, time, type, bounding_box, parameters); 
   
    if (this.size == 0)
    {
        this.head = node; 
        this.tail = node;
        this.cur = node;
    }
    else {
        node.pre = this.tail;
        this.tail.next = node;
        this.tail = node;
    } 
    this.size++; 
    }

    pop()
    {
      if (this.size == 0)
      {
        return;
      }
      if (this.size == 1)
      {
        this.head = null;
        this.tail = null;
        this.cur = null;
      }
      else
      {
        if (this.cur == this.head)
          this.cur = this.head.next;
        this.head = this.head.next;
        this.head.pre = null;
      }
      this.size--;
    }

    remove_current_node()
    {
      if (this.cur == this.head)
        this.pop();
        // pop() already decrements size
      else if (this.cur == this.tail) {
        this.tail = this.tail.pre;
        this.cur = this.head;
        this.size--;
      } else {
        this.cur.pre.next = this.cur.next;
        this.cur.next.pre = this.cur.pre;
        this.cur = this.cur.next;
        this.size--;
      }
    }

    delete(node)
    {
      if (node == this.head)
        this.pop();
        // pop() already decrements size
      else if (node == this.tail) {
        this.tail = this.tail.pre;
        node = this.head;
        this.size--;
      } else {
        node.pre.next = node.next;
        node.next.pre = node.pre;
        node = node.next;
        this.size--;
      }
    }
}


// Axis-aligned Bounding Box for rectangular boxes (main box and ground objects).
class Bounding_Box {
  //  center:         [x,y,z]
  //  manual_scale:   scale for OBJ file
  constructor(center, matrix_transform, width = 1, length = 1, height = 1, manual_scale = null) {
    this.center = center;
    this.matrix_transform = matrix_transform;
    this.width = width, this.length = length, this.height = height;
    this.minX = center[0] - width, this.maxX = center[0] + width;
    this.minY = center[1] - height, this.maxY = center[1] + height;
    this.minZ = center[2] - length, this.maxZ = center[2] + length;
    this.manual_scale = manual_scale;
  }

  get_top()
  {
    return this.maxY;
  }

  update_data(vecXYZ)
  {
    // Update bounding box coordinates
    this.minX = this.minX + vecXYZ[0], this.maxX = this.maxX + vecXYZ[0];
    this.minY = this.minY + vecXYZ[1], this.maxY = this.maxY + vecXYZ[1];
    this.minZ = this.minZ + vecXYZ[2], this.maxZ = this.maxZ + vecXYZ[2];

    // Update Center
    this.center = [this.center[0] + vecXYZ[0], this.center[1] + vecXYZ[1], this.center[2] + vecXYZ[2]];

    // Update the box's matrix transform.
    this.matrix_transform = this.matrix_transform.times(Mat4.translation(vecXYZ));
  }

  // Translates the bounding box if it will not overlap with any object in this.ground.
  //  vecXYZ:       The translation vector.
  //  matrix_list:  The list of ground objects (this.ground).
  //  object_type:  "main_cube" or "spike" or  "bomb"
  //  main_cube:    The Bounding_Box object of the main cube. Pass this in when translating
  //                the spikes/bombs.
  translate(vecXYZ, matrix_lists, object_type, main_cube, should_update_data = true) {
    // returns array of bools, first bool indicates collision detected, second indicates game should end

    let collision_detected = false;
    let game_should_end = false;
    // If we are translating the main cube, check if it will overlap with anything
    // in matrix_list before moving it. If it will, then don't translate.
    let hit_ground = false;
    if (object_type == "main_cube") {
      let newBounds = this.boundsIfTranslate(vecXYZ);
      for (var j = 0; j < matrix_lists.length; j++)
      {
        matrix_lists[j].reset_pointer();
        for (var i = 0; i < matrix_lists[j].length(); i++) { // check objects in each list for collisions
          let temp = matrix_lists[j].next();
          if (temp.object_type() == 'comet_fire')
            continue;
          let object_bounds = temp.get_bounding_box();
          if (temp.object_type() == 'ground' && object_bounds.maxZ < -10)
            break; // can skip the rest of this matrix list because the objects are far away
          if (this.wouldOverlap(object_bounds, newBounds))
          {
            if (temp.object_type() == 'ground')
            {
              vecXYZ[1] = temp.get_bounding_box().get_top() - this.minY;
              this.update_data(vecXYZ);
              hit_ground = true;
            }
            else return [true, true]; // something other than ground was hit, game over
          }
        }
      }
    }
    if (should_update_data)
      this.update_data(vecXYZ);
    return [hit_ground, false];
  }

  // Returns the new {minX, maxX, minY, maxY, minZ, maxZ} if we were to translate
  // the bounding box with vecXYZ (for collision detection). The return value is
  // an array with indices 0, ..., 5.
  boundsIfTranslate(vecXYZ) {
    return [
      this.minX + vecXYZ[0], this.maxX + vecXYZ[0],
      this.minY + vecXYZ[1], this.maxY + vecXYZ[1],
      this.minZ + vecXYZ[2], this.maxZ + vecXYZ[2]
    ];
  }

  // Check if this box overlaps with another box.
  checkOverlap(other_box) {
      return (this.minX <= other_box.maxX && this.maxX >= other_box.minX) &&
             (this.minY <= other_box.maxY && this.maxY >= other_box.minY) &&
             (this.minZ <= other_box.maxZ && this.maxZ >= other_box.minZ);
  };

    // Check if 2 Bounding_Box objects a and b overlap.
//   checkOverlap(a, b) {
//       return (a.minX <= b.maxX && a.maxX >= b.minX) &&
//              (a.minY <= b.maxY && a.maxY >= b.minY) &&
//              (a.minZ <= b.maxZ && a.maxZ >= b.minZ);
//   };

  // Check if this box would overlap with another box if its bounds were newBounds.
  wouldOverlap(other_box, newBounds) {
    let new_minX = newBounds[0], new_maxX = newBounds[1],
        new_minY = newBounds[2], new_maxY = newBounds[3],
        new_minZ = newBounds[4], new_maxZ = newBounds[5];
    
    return (new_minX < other_box.maxX && new_maxX > other_box.minX) &&
           (new_minY < other_box.maxY && new_maxY > other_box.minY) &&
           (new_minZ < other_box.maxZ && new_maxZ > other_box.minZ);
  }

  // Returns the box's matrix transform.
  get_transform() {
    if (this.manual_scale == null)  // Normal case
      return this.matrix_transform.times(Mat4.scale([this.width, this.height, this.length]));  // Must scale at the end.
    else { // Special case: scaling obj file shape but not the bounding box itself.
      let x_scale = this.manual_scale[0];
      let y_scale = this.manual_scale[1];
      let z_scale = this.manual_scale[2];
      return this.matrix_transform.times(Mat4.scale([x_scale, y_scale, z_scale]));  // Must scale at the end.
    }
  }

  // Returns the center of the box.
  get_center() {
    return this.center;
  }
}

function sound(src, volume = 1.0) {
  this.sound = document.createElement("audio");
  this.sound.src = src;
  this.sound.setAttribute("preload", "none");
  this.sound.setAttribute("controls", "none");
  this.sound.volume = volume;
  this.sound.style.display = "none";
  document.body.appendChild(this.sound);
  this.play = function(){
//     var isPlaying = this.sound.currentTime > 0 && !this.sound.paused
//                     && !this.sound.ended && this.sound.readyState > 2;

//     if (!isPlaying) {
      this.sound.load();
      this.sound.play();
//     }

  }
  this.stop = function(){
    this.sound.pause();
    this.sound.currentTime = 0;
  }
  this.load = function(){
    this.sound.load();
  }
  this.set_volume = function(volume){
    this.sound.setAttribute("volume", volume);
  }
}

window.Scene = window.classes.Scene =
class Scene extends Scene_Component { 
  constructor( context, control_box )     // The scene begins by requesting the camera, shapes, and materials it will need.
      { super(   context, control_box );    // First, include a secondary Scene that provides movement controls:
        if( !context.globals.has_controls   )
          context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) );

        const r = context.width/context.height;
        context.globals.graphics_state.camera_transform = Mat4.translation([ 0, -7, -25 ]);  // Locate the camera here (inverted matrix).
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/6, r, .1, 1000 );

        const shapes = { 'background': new Cube(),
                         'box': new Cube(),
                         'main_cube': new Cube(),
                         'long_box': new Cube(),
                         'fretting_circle': new Regular_2D_Polygon(12,12),
                         'ukelele': new Shape_From_File("assets/uke.obj")
                       }
        shapes.box.texture_coords = shapes.box.texture_coords.map( (x, i) => {if (i == 16 || i == 17 || i == 18 || i == 19) return Vec.of(x[0]*=3, x[1]*=.5); // adjust front mapping
                                                                              else if (i == 4 || i == 5 || i == 6 || i == 7) return Vec.of(x[0]*=1, x[1]*=1); // adjust top mapping
                                                                              else return Vec.of(x[0], x[1]);});
        shapes.long_box.texture_coords = shapes.long_box.texture_coords.map( x => Vec.of(x[0]*=1, x[1]*=6));
        this.submit_shapes( context, shapes );

        // calculate TBN matrix for cube normal maps
        let tbn_vectors = this.make_tbn_vectors();

        // Make some Material objects available to you:
        this.materials = 
        {
          semitrans_green: context.get_instance( Phong_Shader ).material( Color.of(0,1,0,0.5), {ambient:1, specularity:0}),
          semitrans_red: context.get_instance( Phong_Shader ).material( Color.of(1,0,0,0.5), {ambient:1, specularity:0}),
          semitrans_yellow: context.get_instance( Phong_Shader ).material( Color.of(1,1,0,0.5), {ambient:1, specularity:0}),
          semitrans_blue: context.get_instance( Phong_Shader ).material( Color.of(0,0,1,0.5), {ambient:1, specularity:0}),
          background1: context.get_instance( Phong_Shader ).material( Color.of( 0,0,0,1 ), { ambient:1, texture: context.get_instance( "assets/beach.jpg", true ) }),
          ground1G: context.get_instance( Bump_Shader ).material( Color.of( .07,.55,.07, 1 ), { ambient: .3, diffusivity: 1  , specularity: .5, 
                                                                                           texture: context.get_instance( "assets/ground_normals.jpg", true ),
                                                                                           tangent: tbn_vectors[0], bitangent: tbn_vectors[1]} ),
          ground1R: context.get_instance( Bump_Shader ).material( Color.of( .55,.07,.07, 1 ), { ambient: .3, diffusivity: 1  , specularity: .5, 
                                                                                           texture: context.get_instance( "assets/ground_normals.jpg", true ),
                                                                                           tangent: tbn_vectors[0], bitangent: tbn_vectors[1]} ),
          ground1Y: context.get_instance( Bump_Shader ).material( Color.of( .55,.55,.07, 1 ), { ambient: .3, diffusivity: 1  , specularity: .5, 
                                                                                           texture: context.get_instance( "assets/ground_normals.jpg", true ),
                                                                                           tangent: tbn_vectors[0], bitangent: tbn_vectors[1]} ),
          ground1B: context.get_instance( Bump_Shader ).material( Color.of( .07,.07,.55, 1 ), { ambient: .3, diffusivity: 1  , specularity: .5, 
                                                                                           texture: context.get_instance( "assets/ground_normals.jpg", true ),
                                                                                           tangent: tbn_vectors[0], bitangent: tbn_vectors[1]} ),
          ground1: context.get_instance( Bump_Shader ).material( Color.of( .55,.55,.55, 0.8), { ambient: .3, diffusivity: 1  , specularity: .5, 
                                                                                           texture: context.get_instance( "assets/ground_normals.jpg", true ),
                                                                                           tangent: tbn_vectors[0], bitangent: tbn_vectors[1]} ),
          ukelele: context.get_instance( Phong_Shader )  .material( Color.of( 0,0,0,0.5 ), { diffusivity: 0.5, ambient: 0.8, texture: context.get_instance("assets/uke_texture.png", true) } ),
        };

        //HElP MENU SLIDER
        this.help_instructions = document.getElementById('cssSlider');
        this.help_instructions_btn1 = document.getElementsByClassName('pNB')[0];
        this.help_instructions_btn2 = document.getElementsByClassName('pNB')[1];
        this.help_instructions_btn3 = document.getElementsByClassName('pNB')[2];
        this.help_instructions_btn4 = document.getElementsByClassName('pNB')[3];

        // Initialize Music / Sounds
        this.C4 = new sound("audio/sounds/C4.mp3", 0.5);
        this.C4S = new sound("audio/sounds/C#4.mp3", 0.5);
        this.D4 = new sound("audio/sounds/D4.mp3", 0.5);
        this.D4S = new sound("audio/sounds/D#4.mp3", 0.5);
        this.E4 = new sound("audio/sounds/E4.mp3", 0.5);
        this.F4 = new sound("audio/sounds/F4.mp3", 0.5);
        this.F4S = new sound("audio/sounds/F#4.mp3", 0.5);
        this.G4 = new sound("audio/sounds/G4.mp3", 0.5);
        this.G4S = new sound("audio/sounds/G#4.mp3", 0.5);
        this.A4 = new sound("audio/sounds/A4.mp3", 0.5);
        this.A4S = new sound("audio/sounds/A#4.mp3", 0.5);
        this.B4 = new sound("audio/sounds/B4.mp3", 0.5);
        this.C5 = new sound("audio/sounds/C5.mp3", 0.5);
        this.C5S = new sound("audio/sounds/C#5.mp3", 0.5);
        this.D5 = new sound("audio/sounds/D5.mp3", 0.5);
        this.D5S = new sound("audio/sounds/D#5.mp3", 0.5);
        this.E5 = new sound("audio/sounds/E5.mp3", 0.5);
        this.F5 = new sound("audio/sounds/F5.mp3", 0.5);
        this.F5S = new sound("audio/sounds/F#5.mp3", 0.5);
        this.G5 = new sound("audio/sounds/G5.mp3", 0.5);
        this.G5S = new sound("audio/sounds/G#5.mp3", 0.5);
        this.A5 = new sound("audio/sounds/A5.mp3", 0.5);

        // Static control intialization
        this.ground_timer = 0.25; // this is used to control how often ground forms
        this.movement_speed = 2.5; //speed of bars coming at ukelele
        this.score = document.getElementById("score");
        this.high_score = document.getElementById("high_score");
        this.high_score_val = 0;
        this.special_mode_display = document.getElementById("special_mode_display");
        this.special_mode_display_tag = document.getElementById("special_mode_display_tag");
        this.pause_display = document.getElementById("pause_display");
        this.stage_display = document.getElementById("stage_display");
        this.game_over_msg = document.getElementById("game_over_msg");
        this.paused_time = 0; // the amount of time that was the game was paused after bomber entry

        // Game initialization
        this.ready_to_start = true;
        this.make_stage1();

        //disable camera focus on player
        this.disableCameraFocus = false;
      }
    make_control_panel()
    {
        this.key_triggered_button( "Restart", [ "r" ], () => {if (this.pause) {this.game_over = true; this.restart = true; this.ready_to_start = true;}});
        this.key_triggered_button( "Start", [ " " ], () => {if (this.ready_to_start) {
          this.start = true; this.help_instructions.style.visibility = 'hidden'; this.ready_to_start = false;
          this.help_instructions_btn1.style.visibility = 'hidden';this.help_instructions_btn2.style.visibility = 'hidden';
          this.help_instructions_btn3.style.visibility = 'hidden';this.help_instructions_btn4.style.visibility = 'hidden';
          }}); // this starts the game
        this.key_triggered_button( "Pause", [ "p" ], () => {this.pause = !this.pause;} );
        this.key_triggered_button( "Free Camera Focus", [ "0" ], () => {this.disableCameraFocus = !this.disableCameraFocus;} );
    }
    make_tbn_vectors()
    {
        let pos1 = Vec.of(-1.0,  1.0, 0.0);
        let pos2 = Vec.of(-1.0, -1.0, 0.0);
        let pos3 = Vec.of( 1.0, -1.0, 0.0);
        let pos4 = Vec.of( 1.0,  1.0, 0.0);
        // texture coordinates
        let uv1 = Vec.of(0.0, 1.0);
        let uv2 = Vec.of(0.0, 0.0);
        let uv3 = Vec.of(1.0, 0.0);
        let uv4 = Vec.of(1.0, 1.0);
        // normal vector
        let nm = Vec.of(0.0, 0.0, 1.0);

        let edge1 = pos2.minus( pos1 );
        let edge2 = pos3.minus( pos1 );
        let deltaUV1 = uv2.minus( uv1 );
        let deltaUV2 = uv3.minus( uv1 );

        let f = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1]);
        let tangent1 = Vec.of(0,0,0);
        tangent1[0] = f * (deltaUV2[1] * edge1[0] - deltaUV1[1] * edge2[0]);
        tangent1[1] = f * (deltaUV2[1] * edge1[1] - deltaUV1[1] * edge2[1]);
        tangent1[2] = f * (deltaUV2[1] * edge1[2] - deltaUV1[1] * edge2[2]);
        let bitangent1 = Vec.of(0,0,0);
        bitangent1[0] = f * (-deltaUV2[0] * edge1[0] + deltaUV1[0] * edge2[0]);
        bitangent1[1] = f * (-deltaUV2[0] * edge1[1] + deltaUV1[0] * edge2[1]);
        bitangent1[2] = f * (-deltaUV2[0] * edge1[2] + deltaUV1[0] * edge2[2]);
        return [tangent1, bitangent1];
    }
    make_stage1()
    {
      // Show title and game instructions
      this.help_instructions.style.visibility = 'visible';
      this.help_instructions_btn1.style.visibility = 'visible';
      this.help_instructions_btn2.style.visibility = 'visible';
      this.help_instructions_btn3.style.visibility = 'visible';
      this.help_instructions_btn4.style.visibility = 'visible';

      this.ground = new Matrix_List(); // all of the ground transformations ar shaderse here
      this.groundString1 = new Matrix_List();
      this.groundString2 = new Matrix_List();
      this.groundString3 = new Matrix_List();
      this.groundString4 = new Matrix_List();
      this.fire_list = new Matrix_List();
      let width = 0, height = 0, length = 0;
      let ground_center = [0,0,0];
      let ground_transform = Mat4.identity();
      let ground_bounding_box = new Bounding_Box(ground_center, ground_transform, width, length, height);
      ground_bounding_box.translate([0,0,-80]);

      this.ground.push(ground_transform, 0, 'ground', ground_bounding_box, {object: 'long_box'}); // initial starting platform
      // game state controls
      this.start = false; // user says when to start the game
      this.game_over = false;  // made true when cube dies
      this.start_time = 0; // when the game starts
      this.final_score = -1;
      this.restart = false;
      this.current_stage = 1;       // 1 through 4
      this.last_time = 0;  // the last time a ground was formed
      this.last_time_bomb = 0;  // the last time a bomb was formed
      this.pause = false;  // pauses movement of all objects
      this.incremental_time = 0;
      this.incremental_time2 = 0;
      this.paused_time = 0;
      //this.time_of_bar = 0;
      //this.time_of_bar_changed = false;

      // Cube initialization
      this.temp_box_transform = Mat4.identity();
      let box_center = [0,0,0];
      this.box = new Bounding_Box(box_center, this.temp_box_transform);
      this.box.translate([0,8,0], [this.ground, this.fire_list], "main_cube");
      
      // Lights
        this.lights = [ new Light( Vec.of( 0,5,-70,1 ), Color.of( 0.5, 0.5, 0, 1 ), 100000 ),
         new Light( Vec.of( 0,5,10,1 ), Color.of( 0.5, 0.5, 0.5, 1 ), 100000 )];
    }
    update_box_pos(t)
    {
      for (let k = 0; k < this.lights.length; k++)
      {
        this.lights[k].position[0] = this.temp_box_transform[0][3]; // move x
        this.lights[k].position[1] = this.temp_box_transform[1][3]; // move y
      }

    }
    spawn_ground(t)
    {
      if (t - this.ground_timer > this.last_time)
      {
        this.last_time = t;
        let frets = [-6,-4.8,-3.6,-2.5,-1.5,-0.6,0.3,1.1,1.9,2.6,3.2,3.7,6]; //x
        let strings = [1.5,2.2,2.9,3.6]; //y
        const width = 0.1;  // 8 to 15
        const height = 0.1; 
        let length = 30; // IMPORTANT FOR TIMING
        let area = width * length; // used to increase the chance of spikes for larger platforms
        let max_area = 15*30;
        let x = frets[Math.floor(Math.random()*frets.length)];
        let y = strings[Math.floor(Math.random()*strings.length)];
        let z = -150;
        let ground_transform = Mat4.identity().times(Mat4.translation([x,y,z]));
        let ground_center = [x,y,z];
        //-6,-4.8,-3.6,-2.5,-1.5,-0.6,0.3,1.1,1.9,2.6,3.2,3.7,6
        if(y == 1.5){
          this.groundString1.push(ground_transform, t, 'ground', new Bounding_Box(ground_center, ground_transform, width, length, height));
          if(x == 6){
            this.A4.play();
          }else if(x == -6){
            this.A4S.play();
          }else if(x == -4.8){
            this.B4.play();
          }else if(x == -3.6){
            this.C5.play();
          }else if(x == -2.5){
            this.C5S.play();
          }else if(x == -1.5){
            this.D5.play();
          }else if(x == -0.6){
            this.D5S.play();
          }else if(x == 0.3){
            this.E5.play();
          }else if(x == 1.1){
            this.F5.play();
          }else if(x == 1.9){
            this.F5S.play();
          }else if(x == 2.6){
            this.G5.play();
          }else if(x == 3.2){
            this.G5S.play();
          }else if(x == 3.7){
            this.A5.play();
          }
        }else if(y == 2.2){
          this.groundString2.push(ground_transform, t, 'ground', new Bounding_Box(ground_center, ground_transform, width, length, height));
          if(x == 6){
            this.E4.play();
          }else if(x == -6){
            this.F4.play();
          }else if(x == -4.8){
            this.F4S.play();
          }else if(x == -3.6){
            this.G4.play();
          }else if(x == -2.5){
            this.G4S.play();
          }else if(x == -1.5){
            this.A4.play();
          }else if(x == -0.6){
            this.A4S.play();
          }else if(x == 0.3){
            this.B4.play();
          }else if(x == 1.1){
            this.C5.play();
          }else if(x == 1.9){
            this.C5S.play();
          }else if(x == 2.6){
            this.D5.play();
          }else if(x == 3.2){
            this.D5S.play();
          }else if(x == 3.7){
            this.E5.play();
          }
        }else if(y == 2.9){
          this.groundString3.push(ground_transform, t, 'ground', new Bounding_Box(ground_center, ground_transform, width, length, height));
          if(x == 6){
            this.C4.play();
          }else if(x == -6){
            this.C4S.play();
          }else if(x == -4.8){
            this.D4.play();
          }else if(x == -3.6){
            this.D4S.play();
          }else if(x == -2.5){
            this.E4.play();
          }else if(x == -1.5){
            this.F4.play();
          }else if(x == -0.6){
            this.F4S.play();
          }else if(x == 0.3){
            this.G4.play();
          }else if(x == 1.1){
            this.G4S.play();
          }else if(x == 1.9){
            this.A4.play();
          }else if(x == 2.6){
            this.A4S.play();
          }else if(x == 3.2){
            this.B4.play();
          }else if(x == 3.7){
            this.C5.play();
          }
        }else if(y == 3.6){
          this.groundString4.push(ground_transform, t, 'ground', new Bounding_Box(ground_center, ground_transform, width, length, height));
          if(x == 6){
            this.G4.play();
          }else if(x == -6){
            this.G4S.play();
          }else if(x == -4.8){
            this.A4.play();
          }else if(x == -3.6){
            this.A4S.play();
          }else if(x == -2.5){
            this.B4.play();
          }else if(x == -1.5){
            this.C5.play();
          }else if(x == -0.6){
            this.C5S.play();
          }else if(x == 0.3){
            this.D5.play();
          }else if(x == 1.1){
            this.D5S.play();
          }else if(x == 1.9){
            this.E5.play();
          }else if(x == 2.6){
            this.F5.play();
          }else if(x == 3.2){
            this.F5S.play();
          }else if(x == 3.7){
            this.G5.play();
          }
        }
      }
    }
    move_box(graphics_state, t)
      {
        if (!this.pause)
          this.update_box_pos(t);
        let model_transform_camera = this.temp_box_transform; // point the camera at the moving cube
        model_transform_camera = model_transform_camera.times( Mat4.translation([0,7,28]) );
        model_transform_camera = Mat4.inverse( model_transform_camera );
        model_transform_camera = model_transform_camera.map( (x,i) => Vec.from( graphics_state.camera_transform[i] ).mix( x, 0.1 ) );
        if (!this.disableCameraFocus)
        {
          graphics_state.camera_transform = model_transform_camera;
        }
        graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
      }
    end_game(graphics_state, t)
    {
      this.pause = true;
      if (this.final_score == -1)
      {
        this.final_score = 10*t;
      }
      this.update_score(this.final_score);
    }
    check_intersection(coord, bound)
    {
      return ((coord[0] <= bound.maxX && coord[0] >= bound.minX) &&
             (coord[1] <= bound.maxY && coord[1] >= bound.minY) &&
             (coord[2] <= bound.maxZ && coord[2] >= bound.minZ));
    }
    check_bounds(bound, minY, maxY, minX, maxX, minZ, maxZ)
    {
      return (minX <= bound.maxX && maxX >= bound.minX) &&
             (minY <= bound.maxY && maxY >= bound.minY) &&
             (minZ <= bound.maxZ && maxZ >= bound.minZ);
    }
    draw_ground(graphics_state, t)
    {
      this.ground.reset_pointer();
      let len = this.ground.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.ground.get_current_node();
        let temp_bounding_box = temp.get_bounding_box();
        // Keep moving the ground (and spikes) toward us if the game is not paused.
        if (!this.pause)
          temp_bounding_box.translate([0,0,this.movement_speed*(t-temp.time())]);

        let model = temp_bounding_box.get_transform();
        if (temp_bounding_box.minZ > 3) {  // z coord of ground is 200, so we can get rid of this ground object.
          this.ground.remove_current_node();
        }
        else 
        {
          this.ground.advance_node(); // move the pointer through the list if there was no deletion
          // Draw the ground relative to the cube's current x coord.
          if (temp.object_type() == 'ground')
          {
            this.shapes.long_box.draw(graphics_state, model, this.materials.ground1);
          }
        }
      }
      this.groundString1.reset_pointer();
      len = this.groundString1.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.groundString1.get_current_node();
        let temp_bounding_box = temp.get_bounding_box();
        // Keep moving the ground (and spikes) toward us if the game is not paused.
        if (!this.pause)
          temp_bounding_box.translate([0,0,this.movement_speed*(t-temp.time())]);

        let model = temp_bounding_box.get_transform();
        if (temp_bounding_box.minZ > 3) {  // z coord of ground is 200, so we can get rid of this ground object.
          this.groundString1.remove_current_node();
        }
        else 
        {
          this.groundString1.advance_node(); // move the pointer through the list if there was no deletion
          // Draw the ground relative to the cube's current x coord.
          if (temp.object_type() == 'ground')
          {
              this.shapes.long_box.draw(graphics_state, model, this.materials.ground1G);
          }
        }
      }
      this.groundString2.reset_pointer();
      len = this.groundString2.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.groundString2.get_current_node();
        let temp_bounding_box = temp.get_bounding_box();
        // Keep moving the ground (and spikes) toward us if the game is not paused.
        if (!this.pause)
          temp_bounding_box.translate([0,0,this.movement_speed*(t-temp.time())]);

        let model = temp_bounding_box.get_transform();
        if (temp_bounding_box.minZ > 3) {  // z coord of ground is 200, so we can get rid of this ground object.
          this.groundString2.remove_current_node();
        }
        else 
        {
          this.groundString2.advance_node(); // move the pointer through the list if there was no deletion
          // Draw the ground relative to the cube's current x coord.
          if (temp.object_type() == 'ground')
          {
            this.shapes.long_box.draw(graphics_state, model, this.materials.ground1R);
          }
        }
      }
      this.groundString3.reset_pointer();
      len = this.groundString3.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.groundString3.get_current_node();
        let temp_bounding_box = temp.get_bounding_box();
        // Keep moving the ground (and spikes) toward us if the game is not paused.
        if (!this.pause)
          temp_bounding_box.translate([0,0,this.movement_speed*(t-temp.time())]);

        let model = temp_bounding_box.get_transform();
        if (temp_bounding_box.minZ > 3) {  // z coord of ground is 200, so we can get rid of this ground object.
          this.groundString3.remove_current_node();
        }
        else 
        {
          this.groundString3.advance_node(); // move the pointer through the list if there was no deletion
          // Draw the ground relative to the cube's current x coord.
          if (temp.object_type() == 'ground')
          {
            this.shapes.long_box.draw(graphics_state, model, this.materials.ground1Y);
          }
        }
      }
      this.groundString4.reset_pointer();
      len = this.groundString4.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.groundString4.get_current_node();
        let temp_bounding_box = temp.get_bounding_box();
        // Keep moving the ground (and spikes) toward us if the game is not paused.
        if (!this.pause)
          temp_bounding_box.translate([0,0,this.movement_speed*(t-temp.time())]);

        let model = temp_bounding_box.get_transform();
        if (temp_bounding_box.minZ > 3) {  // z coord of ground is 200, so we can get rid of this ground object.
          this.groundString4.remove_current_node();
        }
        else 
        {
          this.groundString4.advance_node(); // move the pointer through the list if there was no deletion
          // Draw the ground relative to the cube's current x coord.
          if (temp.object_type() == 'ground')
          {
            this.shapes.long_box.draw(graphics_state, model, this.materials.ground1B);
          }
        }
      }
    }
    update_score(newScore) {  // newScore: int
      this.score.innerHTML = "SCORE: " + newScore.toFixed(0);
      if (newScore > this.high_score_val) {
        this.high_score_val = newScore;
      }
      this.high_score.innerHTML = "HIGH SCORE: " + this.high_score_val.toFixed(0);
    }
    show_pause_display() {
      // Display "THE GAME IS PAUSED" at the top of the screen
      if (!this.start){
        this.pause_display.innerHTML = "";
      }
      else if((this.game_over && this.start) || (!this.pause && this.start)){
        this.pause_display.innerHTML = ""; 
      }
      else if(this.pause){
        this.pause_display.innerHTML = "GAME PAUSED - PRESS [P] TO RESUME.";
      }
    }
    show_stage_display(t) {
      // Briefly display stage number and short message at the start of each stage
      const display_length = 5;  // how long to display each message
      if (this.start && this.current_stage == 1 && t < display_length)
        this.stage_display.innerHTML = "TAKE #1 (UKELELE): Random notes";
      else
        this.stage_display.innerHTML = "";
    }
    show_game_over_msg() {
      if (this.game_over)
        this.game_over_msg.innerHTML = "You died! Press [R] to restart!";
      else
        this.game_over_msg.innerHTML = "";
    }
    display( graphics_state )
      { 
        const total_time = graphics_state.animation_time/1000, dt = graphics_state.animation_delta_time / 1000;
        if (!this.start) {
          this.start_time = total_time;
          this.incremental_time = total_time;
          this.incremental_time2 = total_time;
        }
        if (!this.pause && this.start) {
          this.incremental_time = this.incremental_time + dt;
          this.incremental_time2 = this.incremental_time2 + dt;
        }
        else if (this.game_over || (this.start && !this.pause))
          this.incremental_time2 = this.incremental_time2 + dt;

        let t = this.incremental_time - this.start_time; // t is the amount of time that has elapsed since the user started the game
        let t2 = this.incremental_time2 - this.start_time;
        if (this.pause) this.paused_time = this.paused_time + dt;
        if (this.game_over)
        {                                     // DO NOT MOVE THIS CODE!
          this.end_game(graphics_state, t);
          if (this.restart)
          {
            this.make_stage1();
            return;
          }
        }
        this.move_box(graphics_state, t); // move the user's box
        this.update_score(10*t);
        this.shapes.background.draw(graphics_state, Mat4.identity()
          .times(Mat4.translation([0,0,0]))
          .times(Mat4.scale([400,400,400])), this.materials.background1);
        this.shapes.ukelele.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-8,2,0]))
          .times(Mat4.rotation(Math.PI * 0.5, Vec.of(0,1,0)))
          .times(Mat4.rotation(Math.PI * -0.5, Vec.of(0,0,1)))
          .times(Mat4.scale([5,5,5])), this.materials.ukelele);
        /////////FRETS////////////////////////////////////////
        //1st String
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([6,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-6,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-4.8,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-3.6,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-2.5,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-1.5,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-0.6,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([0.3,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([1.1,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([1.9,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([2.6,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([3.2,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([3.7,1.5,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_green);
        //2nd String
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([6,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-6,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-4.8,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-3.6,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-2.5,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-1.5,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-0.6,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([0.3,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([1.1,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([1.9,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([2.6,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([3.2,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([3.7,2.2,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_red);
        //3rd String
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([6,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-6,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-4.8,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-3.6,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-2.5,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-1.5,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-0.6,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([0.3,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([1.1,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([1.9,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([2.6,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([3.2,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([3.7,2.9,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_yellow);
        //4th String
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([6,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-6,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-4.8,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-3.6,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-2.5,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-1.5,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([-0.6,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([0.3,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([1.1,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([1.9,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([2.6,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([3.2,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        this.shapes.fretting_circle.draw( graphics_state, Mat4.identity()
          .times(Mat4.translation([3.7,3.6,3]))
          .times(Mat4.scale([0.15,0.15,0.15])), this.materials.semitrans_blue);
        if (!this.game_over){
          this.spawn_ground(t);
        }
        this.draw_ground(graphics_state, t);
        this.show_pause_display();
        this.show_stage_display(t);
        this.show_game_over_msg();
      }
  }