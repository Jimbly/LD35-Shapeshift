/*jshint browser:true*/

/*global $: false */
/*global TurbulenzEngine: true */
/*global Draw2D: false */
/*global Draw2DSprite: false */
/*global RequestHandler: false */
/*global TextureManager: false */
/*global Camera: false */
/*global VMath: false */

TurbulenzEngine.onload = function onloadFn()
{
  var intervalID;
  var graphicsDevice = TurbulenzEngine.createGraphicsDevice({});
  var mathDevice = TurbulenzEngine.createMathDevice({});
  var draw2D = Draw2D.create({ graphicsDevice });
  var requestHandler = RequestHandler.create({});
  var textureManager = TextureManager.create(graphicsDevice, requestHandler);
  var inputDevice = TurbulenzEngine.createInputDevice({});
  var input = require('./input.js').create(inputDevice, draw2D);
  var random_seed = require('random-seed');

  var soundDeviceParameters = {
    linearDistance : false
  };
  var soundDevice = TurbulenzEngine.createSoundDevice(soundDeviceParameters);
  var camera = Camera.create(mathDevice);
  var lookAtPosition = mathDevice.v3Build(0.0, 0.0, 0.0);
  var worldUp = mathDevice.v3BuildYAxis();
  var cameraPosition = mathDevice.v3Build(0.0, 0.0, 1.0);
  camera.lookAt(lookAtPosition, worldUp, cameraPosition);
  camera.updateViewMatrix();
  soundDevice.listenerTransform = camera.matrix;
  var sound_source_mid = soundDevice.createSource({
    position : mathDevice.v3Build(0, 0, 0),
    relative : false,
    pitch : 1.0,
  });

  var sounds = {};
  function loadSound(base) {
    var src = 'sounds/' + base;
    // if (soundDevice.isSupported('FILEFORMAT_WAV')) {
    src += '.wav';
    // } else {
    //   src += '.ogg';
    // }
    soundDevice.createSound({
      src: src,
      onload: function (sound) {
        if (sound) {
          sounds[base] = sound;
        }
      }
    });
  }
  loadSound('drop_match');
  loadSound('drop_no_match');
  loadSound('drop_good');
  loadSound('select');
  loadSound('land');
  loadSound('match_3');
  loadSound('match_4');
  loadSound('match_5');
  loadSound('match_6');
  function playSound(source, soundname) {
    if (!sounds[soundname]) {
      return;
    }
    source._last_played = source._last_played || {};
    let last_played_time = source._last_played[soundname] || -9e9;
    if (global_timer - last_played_time < 45) {
      return;
    }
    source.play(sounds[soundname]);
    source._last_played[soundname] = global_timer;
  }

  var textures = {};
  function loadTexture(texname) {
    var path = texname;
    if (texname.indexOf('.') !== -1) {
      path = 'img/'+ texname;
    }
    var inst = textureManager.getInstance(path);
    if (inst) {
      return inst;
    }
    textures[texname] = textureManager.load(path, false);
    return textureManager.getInstance(path);
  }
  function createSprite(texname, params) {
    var tex_inst = loadTexture(texname);
    params.texture = tex_inst.getTexture();
    var sprite = Draw2DSprite.create(params);
    tex_inst.subscribeTextureChanged(function () {
      sprite.setTexture(tex_inst.getTexture());
    });
    return sprite;
  }

  var score_host = 'http://scores.dashingstrike.com';
  if (window.location.host.indexOf('localhost') !== -1 ||
    window.location.host.indexOf('staging') !== -1) {
    score_host = 'http://scores.staging.dashingstrike.com';
  }
  function formatScore(score) {
    let r = score + '00';
    if (r.length > 3) {
      r = r.slice(0, -3) + ',' + r.slice(-3);
    }
    return r;
  }
  function formatHighScore(high_score) {
    let moves = 10000 - (high_score % 10000);
    return formatScore(Math.floor(high_score / 10000).toFixed(0)) + ' in ' + moves + ' -';
  }

  let num_highscores = 20;

  function refreshScores() {
    $.ajax({ url: score_host + '/api/scoreget?key=LD35&limit=' + num_highscores, success: function (scores) {
      var html = [];
      scores.forEach(function (score, idx) {
        var name = score.name;
        if (name.indexOf('Anonymous') === 0) {
          name = name.slice(0, 'Anonymous'.length);
        }
        html.push('#' + (idx +1) + '. ' + formatHighScore(score.score) + ' ' + name);
      });
      $('#scores').text(html.join('\n'));
    }});
  }

  // Preload
  loadTexture('test.png');

  // Viewport for Draw2D.
  var game_width = 512 * 4/3;
  var game_height = 570;
  var color_white = mathDevice.v4Build(1, 1, 1, 1);
  var color_red = mathDevice.v4Build(1, 0, 0, 1);
  var color_yellow = mathDevice.v4Build(1, 1, 0, 1);

  // Cache keyCodes
  var keyCodes = inputDevice.keyCodes;
  var padCodes = input.padCodes;

  var configureParams = {
    scaleMode : 'scale',
    viewportRectangle : mathDevice.v4Build(0, 0, game_width, game_height)
  };

  var global_timer = 0;
  var game_state;

  function titleInit(dt) {
    $('.screen').hide();
    $('#title').show();
    game_state = title;
    title(dt);
  }

  function title(dt) {
    //test(dt);
    if (true && 'ready') {
      game_state = playInit;
    }
  }

  function inputDown() {
    return input.isMouseDown() || input.isTouchDown();
  }

  let player_name = 'Anonymous ' + Math.random().toString().slice(2, 8);

  function clearScore(old_player_name) {
    if (!old_player_name) {
      return;
    }
    $.ajax({ url: score_host + '/api/scoreclear?key=LD35&name=' + old_player_name, success: function (scores) {
    }});
  }

  function submitScore() {
    if (submitScore.in_progress) {
      submitScore.need_submit = true;
      return;
    }
    if (!score) {
      return;
    }
    let high_score = score * 10000 + (10000 - moves);
    if (!player_name) {
      return;
    }
    submitScore.in_progress = true;
    submitScore.need_submit = false;
    $.ajax({ url: score_host + '/api/scoreset?key=LD35&name=' + player_name + '&score=' + high_score, success: function (scores) {
      var html = [];
      var had_b = false;
      scores.forEach(function (score, idx) {
        var disp_name = score.name;
        if (disp_name.indexOf('Anonymous') === 0) {
          disp_name = disp_name.slice(0, 'Anonymous'.length);
        }
        var b = Math.abs(score.score - high_score) < 0.01 && !had_b && score.name === player_name;
        if (b) {
          had_b = true;
        }
        if (b || html.length < num_highscores) {
          html.push('#' + (idx +1) + '. ' + (b ? ' *** ' : '') + formatHighScore(score.score) + ' ' + disp_name + (b ? ' ***' : ''));
        }
      });
      $('#scores').text(html.join('\n'));
      submitScore.in_progress = false;
      if (submitScore.need_submit) {
        submitScore();
      }
    }});
  }

  function playInit(dt) {
    refreshScores();
    $('.screen').hide();
    $('#play').show();
    game_state = play;
    play(dt);
    //inputDevice.onBlur();
    $('#canvas').focus();
    $('#name').focus(function () {
      inputDevice.onBlur();
    });
    $('#name').change(function (ev) {
      clearScore(player_name);
      player_name = $('#name').val();
      // also re-submit score?
    });
    $('#name').blur(function () {
      submitScore();
    });
  }

  var piece_sprites;
  var num_pieces;
  var board;
  var faders = [];
  var rand;

  function convertHSVtoRGB(h, s, v) {
    h = h % 1;
    var r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v, g = t, b = p; break;
      case 1: r = q, g = v, b = p; break;
      case 2: r = p, g = v, b = t; break;
      case 3: r = p, g = q, b = v; break;
      case 4: r = t, g = p, b = v; break;
      case 5: r = v, g = p, b = q; break;
    }
    return [r, g, b, 1];
  }
  let hue0 = 0;
  let dhue = 56;
  let sat = 0.7;
  let val = 1.0;
  const colors = [
    convertHSVtoRGB((hue0 + dhue*0) / 360, sat, val),
    convertHSVtoRGB((hue0 + dhue*1) / 360, sat, val),
    convertHSVtoRGB((hue0 + dhue*2) / 360, sat, val),
    convertHSVtoRGB((hue0 + dhue*3) / 360, sat, val),
    convertHSVtoRGB((hue0 + dhue*4) / 360, sat, val),
    convertHSVtoRGB((hue0 + dhue*5) / 360, sat, val),
  ];

  function newPiece() {
    return rand(num_pieces);
  }
  function newBoardEntry() {
    let v = newPiece();
    //let color = colors[v];
    let color = colors[newPiece()];
    return {
      v,
      color,
      offset: 0,
    };
  }
  function getobj(x, y) {
    if (y < 0 || y >= board.length) {
      return;
    }
    return board[y][x];
  }
  function getshape(x, y) {
    if (y < 0 || y >= board.length) {
      return;
    }
    return board[y][x] && board[y][x].v;
  }
  function getcolor(board, x, y) {
    if (y < 0 || y >= board.length) {
      return;
    }
    return board[y][x] && board[y][x].color;
  }
  function getobjWrapped(x, y) {
    if (y < 0) {
      y += board.length;
    }
    if (y >= board.length) {
      y -= board.length;
    }
    let row = board[y];
    if (x < 0) {
      x += row.length;
    }
    if (x >= row.length) {
      x -= row.length;
    }
    return row[x];
  }
  function getshapeWrapped(x, y) {
    return getobjWrapped(x, y).v;
  }
  function getcolorWrapped(x, y) {
    return getobjWrapped(x, y).color;
  }
  function cmpDrawList(a, b) {
    if (a.z !== b.z) {
      return a.z - b.z;
    }
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    return a.x - b.x;
  }

  function shiftBoardDestroy(remove, shift) {
    let newboard = [];
    for (let ii = 0; ii < board.length; ++ii) {
      let row = newboard[ii] = [];
      for (let jj = 0; jj < board[ii].length; ++jj) {
        if (getshape(jj - shift[0], ii - shift[1]) === drag_type) {
          row[jj] = getobj(jj - shift[0], ii - shift[1]);
        } else if (getshape(jj, ii) === drag_type) {
          row[jj] = {};// getobj(jj, ii); // empty spot
          remove[ii] = remove[ii] || [];
          remove[ii][jj] = true;
        } else {
          row[jj] = getobj(jj, ii);
        }
      }
    }
    return newboard;
  }

  function shiftBoardSwap(remove, shift) {
    let newboard = [];
    for (let ii = 0; ii < board.length; ++ii) {
      let row = newboard[ii] = [];
      for (let jj = 0; jj < board[ii].length; ++jj) {
        if (getshapeWrapped(jj - shift[0], ii - shift[1]) === drag_type) {
          row[jj] = getobjWrapped(jj - shift[0], ii - shift[1]);
        } else if (getshapeWrapped(jj, ii) === drag_type) {
          // search shift direction and get the first non-dragged type
          let d = 1;
          while (getshapeWrapped(jj + d * shift[0], ii + d * shift[1]) === drag_type) {
            ++d;
          }
          row[jj] = getobjWrapped(jj + d * shift[0], ii + d * shift[1]);
        } else {
          row[jj] = getobj(jj, ii);
        }
      }
    }
    return newboard;
  }

  let shiftBoard = shiftBoardSwap;

  function doRemove(board, remove, quick, no_fill) {
    let ret = false;
    for (let ii = 0; ii < board.length; ++ii) {
      if (remove[ii]) {
        let row = board[ii];
        for (let jj = 0; jj < row.length; ++jj) {
          if (remove[ii][jj]) {
            if (remove[ii][jj] === 'match' && !quick) {
              faders.push({ x: jj, y: ii, value: board[ii][jj].v, color: board[ii][jj].color, t: 1 });
            }
            // drop things
            // add offsets to things, animate offsets down
            for (let kk = 0; kk < ii; ++kk) {
              let elem = board[ii - kk][jj] = board[ii - kk - 1][jj];
              if (!quick && elem) {
                elem.offset += 1;
              }
            }
            let offset = (board[0][jj] && board[0][jj].offset) || 1; // already incremented + 1, if anything was there
            if (quick) {
              offset = 0;
            }
            board[0][jj] = no_fill ? null : newBoardEntry();
            if (board[0][jj]) {
              board[0][jj].offset = offset;
            }
            ret = true;
          }
        }
      }
    }
    return ret;
  }

  function willMakeMatch(shift) {
    // clone board, do shift
    let remove = [];
    let tempboard = shiftBoard(remove, shift);
    // do drop
    doRemove(tempboard, remove, true, true);

    // check for matches
    for (let ii = 0; ii < tempboard.length; ++ii) {
      let row = tempboard[ii];
      for (let jj = 0; jj < row.length; ++jj) {
        if (!row[jj]) {
          continue;
        }
        let value = row[jj].color;
        if (!value) {
          continue;
        }
        let hmatch_length = 1;
        for (hmatch_length = 1; getcolor(tempboard, jj + hmatch_length, ii) === value; ++hmatch_length) {
        }
        if (hmatch_length >= 3) {
          return true;
        }
        let vmatch_length = 1;
        for (vmatch_length = 1; getcolor(tempboard, jj, ii + vmatch_length) === value; ++vmatch_length) {
        }
        if (vmatch_length >= 3) {
          return true;
        }
      }
    }
  }

  var dragging = -1;
  var drag_type;
  var drag_start = null;
  var drag_offs = null;
  var drag_touch = false;
  var score = 0;
  var moves = 0;
  const drag_scale = 1.2;
  var border_sprite;
  var bg_sprite;

  function isAnimating() {
    for (let ii = 0; ii < board.length; ++ii) {
      let row = board[ii];
      for (let jj = 0; jj < row.length; ++jj) {
        if (row[jj] && row[jj].offset) {
          return true;
        }
      }
    }
    if (faders.length > 0) {
      return true;
    }
    return false;
  }

  let levels = [
    {
      msg: 'Initializing',
      check: function () {
        return true;
      }
    },
    {
      start: function () {
        num_pieces = 4;
        rand = random_seed.create('level1a'); // 'level1' has a match-9 combo off the bat!
      },
      msg: 'Level 1 - 4 Color - Next: 2,500 points',
      check: function () {
        return score >= 25 && !isAnimating();
      }
    },
    {
      start: function () {
        num_pieces = 5;
        rand = random_seed.create('level2');
      },
      msg: 'Level 2 - 5 Color - Next: 5,000 points',
      check: function () {
        return score >= 50 && !isAnimating();
      }
    },
    {
      start: function () {
        num_pieces = piece_sprites.length;
        rand = random_seed.create('level3');
      },
      msg: 'Final Level - 6 Color - Goal: 10,000 points',
      check: function () {
        return score >= 100 && !isAnimating();
      }
    },
    {
      start: function () {
        num_pieces = piece_sprites.length;
        rand = random_seed.create('level4');
      },
      msg: 'All levels complete!  Free play!',
      check: function () {
        return false;
      }
    }
  ];
  let level = 0;


  function play(dt) {
    var spriteSize = 64;
    if (!piece_sprites) {
      piece_sprites = [];
      for (let ii = 0; ii < 6; ++ii) {
        piece_sprites[ii] = createSprite('tiles_0000s_000' + ii + '_' + ii + '.png', {
          width : spriteSize,
          height : spriteSize,
          x : 0,
          y : 0,
          rotation : 0,
          color : color_white,
          //origin: [0, 0],
          textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize)
        });
      }

      border_sprite = createSprite('border.png', {
        width : 512,
        height : 1024,
        x : 0,
        y : 0,
        rotation : 0,
        color : color_white,
        origin: [0, 0],
        textureRectangle : mathDevice.v4Build(0, 0, 512, 1024)
      });
      bg_sprite = createSprite('background.png', {
        width : 512,
        height : 1024,
        x : 0,
        y : 0,
        rotation : 0,
        color : color_white,
        origin: [0, 0],
        textureRectangle : mathDevice.v4Build(0, 0, 512, 1024)
      });
    }

    let new_board = false;
    if (levels[level].check() || !board) {
      ++level;
      levels[level].start();
      $('#level').html(levels[level].msg);
      new_board = true;
    }

    if (new_board) {
      board = [];
      for (let ii = 0; ii < 6; ++ii) {
        board[ii] = [];
        for (let jj = 0; jj < 6; ++jj) {
          board[ii].push(newBoardEntry());
        }
      }
    }

    // remove matches
    let animating = false;
    let removed = false;
    let remove = [];

    let fading = false;
    for (let ii = 0; ii < faders.length; ++ii) {
      if (faders[ii].t > 0.4) {
        fading = true;
        animating = true;
      }
    }

    if (!fading) {
      let doffs = dt / 300;
      let landed = false;
      for (let ii = 0; ii < board.length; ++ii) {
        let row = board[ii];
        for (let jj = 0; jj < row.length; ++jj) {
          if (row[jj] && row[jj].offset) {
            if (doffs > row[jj].offset) {
              landed = true;
              row[jj].offset = 0;
            } else {
              animating = true;
              row[jj].offset -= doffs;
            }
          }
        }
      }
      if (landed) {
        playSound(sound_source_mid, 'land');
      }
    }

    do {
      if (animating) {
        break;
      }
      let combo_ids = [];
      let last_combo_id = 0;
      function fillCombos(x, y, combo_id) {
        combo_ids[y] = combo_ids[y] || [];
        let old_combo_id = combo_ids[y][x];
        combo_ids[y][x] = combo_id;
        if (old_combo_id && old_combo_id !== combo_id) {
          for (let ii = 0; ii < combo_ids.length; ++ii) {
            if (combo_ids[ii]) {
              for (let jj = 0; jj < combo_ids[ii].length; ++jj) {
                if (combo_ids[ii][jj] === old_combo_id) {
                  combo_ids[ii][jj] = combo_id;
                }
              }
            }
          }
        }
      }
      // Check for matches
      removed = false;
      for (let ii = 0; ii < board.length; ++ii) {
        let row = board[ii];
        for (let jj = 0; jj < row.length; ++jj) {
          if (!row[jj]) {
            continue;
          }
          let value = row[jj].color;
          let hmatch_length = 1;
          let combo_id = ++last_combo_id;
          for (hmatch_length = 1; getcolor(board, jj + hmatch_length, ii) === value; ++hmatch_length) {
          }
          if (hmatch_length >= 3) {
            removed = true;
            remove[ii] = remove[ii] || [];
            for (let kk = 0; kk < hmatch_length; ++kk) {
              remove[ii][jj + kk] = 'match';
              fillCombos(jj + kk, ii, combo_id);
            }
          }
          let vmatch_length = 1;
          for (vmatch_length = 1; getcolor(board, jj, ii + vmatch_length) === value; ++vmatch_length) {
          }
          if (vmatch_length >= 3) {
            removed = true;
            for (let kk = 0; kk < vmatch_length; ++kk) {
              remove[ii + kk] = remove[ii + kk] || [];
              remove[ii + kk][jj] = 'match';
              fillCombos(jj, ii + kk, combo_id);
            }
          }
        }
      }
      if (!new_board) {
        let count = {};
        for (let ii = 0; ii < combo_ids.length; ++ii) {
          if (combo_ids[ii]) {
            for (let jj = 0; jj < combo_ids[ii].length; ++jj) {
              let c = combo_ids[ii][jj];
              if (c) {
                count[c] = (count[c] || 0) + 1;
              }
            }
          }
        }
        let combo_total = 0;
        let max_combo = 0;
        let messages = '';
        for (let c in count) {
          max_combo = Math.max(count[c], max_combo);
          let score_mod = Math.floor(Math.pow(count[c] - 2, 1.5));
          score += score_mod;
          messages = messages + count[c] + '-match combo ' + formatScore(score_mod) + ' pts!<br/>';
          combo_total += count[c];
        }
        if (combo_total) {
          $('#messages').html(messages);
          $('#score').text(formatScore(score));
          submitScore();
          playSound(sound_source_mid, 'match_' + Math.max(3, Math.min(6, max_combo)));
        }
      }

      if (removed && new_board) {
        // immediately remove, no animation
        doRemove(board, remove, true, false);
        remove = [];
      }
    } while (removed && new_board);

    if (dragging !== -1 && !inputDown()) {
      // stop dragging
      if (Math.max(Math.abs(drag_offs[0]), Math.abs(drag_offs[1])) > 0.5) {
        // do a shift!
        let shift = [Math.max(-1, Math.min(1, drag_offs[0] * 2)),
          Math.max(-1, Math.min(1, drag_offs[1] * 2))];
        if (!willMakeMatch(shift)) {
          board = shiftBoard(remove, shift);
          playSound(sound_source_mid, 'drop_good');
          // If we allow the shift, might make a match with new pieces anyway.
          //playSound(sound_source_mid, 'drop_no_match');
        } else {
          board = shiftBoard(remove, shift);
          playSound(sound_source_mid, 'drop_good');
        }
        ++moves;
        $('#moves').text(moves + ((moves === 1) ? ' move' : ' moves'));
      } else {
        playSound(sound_source_mid, 'select');
      }
      drag_type = null;
      dragging = -1;
      drag_start = null;
      drag_offs = null;
      drag_touch = false;
    }


    if (!animating) {
      animating = doRemove(board, remove, false, false);
    }

    // draw and input

    let shift = null;
    if (dragging !== -1) {
      let mouse_pos = input.mousePos();
      if (drag_touch) {
        let touch_pos = [];
        if (input.isTouchDown(-1e9, -1e9, 2e9, 2e9, touch_pos)) {
          mouse_pos = touch_pos;
        }
      }
      let delta = [mouse_pos[0] - drag_start[0], mouse_pos[1] - drag_start[1]];
      let len = Math.min(1, VMath.v2Length(delta) / spriteSize);
      VMath.v2Normalize(delta, delta);
      let offx = delta[0]; // VMath.v2PerpDot(delta, [1, 0]);
      let offy = delta[1]; //VMath.v2PerpDot(delta, [0, 1]);
      let sr2o2 = Math.sqrt(2)/2;
      if (Math.abs(offx) > Math.abs(offy)) {
        // horizontal drag
        drag_offs[0] = (offx - ((offx < 0) ? -1 : 1) * sr2o2) / (1 - sr2o2) * len;
        drag_offs[1] = 0;
      } else {
        // vertical drag
        drag_offs[0] = 0;
        drag_offs[1] = (offy - ((offy < 0) ? -1 : 1) * sr2o2) / (1 - sr2o2) * len;
      }
      if (Math.max(Math.abs(drag_offs[0]), Math.abs(drag_offs[1])) > 0.5) {
        // will do a shift!
        shift = [Math.max(-1, Math.min(1, drag_offs[0] * 2)),
          Math.max(-1, Math.min(1, drag_offs[1] * 2))];
      }
    }

    let draw_list = [];
    let margin_left = spriteSize * 3 / 2;
    let margin_top = 64 + spriteSize / 2;

    bg_sprite.x = border_sprite.x = margin_left - 64 - spriteSize/2;
    bg_sprite.y = border_sprite.y = margin_top - 64 - spriteSize/2;
    draw2D.drawSprite(bg_sprite);

    for (let ii = 0; ii < board.length; ++ii) {
      let row = board[ii];
      for (let jj = 0; jj < row.length; ++jj) {
        if (!row[jj]) {
          continue;
        }
        let x = margin_left + spriteSize * jj;
        let y = margin_top + spriteSize * ii;
        let z = 1;
        let index = ii * board.length + jj;
        let scale = 1;
        let shape = getshape(jj, ii);
        if (drag_type === shape) {
          scale = drag_scale;
          z = 2;
        } else if (dragging === -1 && !animating) {
          let sprite = piece_sprites[shape];
          sprite.x = x;
          sprite.y = y;
          let touch_pos = [];
          if (input.isMouseOverSprite(sprite)) {
            scale = 1.1;
            if (inputDown()) {
              dragging = index;
              drag_type = shape;
              drag_start = input.mousePos();
              drag_offs = [0, 0];
              drag_touch = false;
              playSound(sound_source_mid, 'select');
            }
          } else if (input.isTouchDownSprite(sprite, touch_pos)) {
            dragging = index;
            drag_type = shape;
            drag_start = touch_pos;
            drag_offs = [0, 0];
            drag_touch = true;
            playSound(sound_source_mid, 'select');
          }
        }
        y -= board[ii][jj].offset * spriteSize;
        if (y < spriteSize/2) {
          continue;
        }
        let color = board[ii][jj].color;
        if (drag_type === shape) {
          x += drag_offs[0] * spriteSize;
          y += drag_offs[1] * spriteSize;

          if (jj === 0 && drag_offs[0] < 0) {
            draw_list.push({
              x: x + row.length * spriteSize, y, z, scale, shape, color
            });
          }
          if (jj === row.length-1 && drag_offs[0] > 0) {
            draw_list.push({
              x: x - row.length * spriteSize, y, z, scale, shape, color
            });
          }
          if (ii === 0 && drag_offs[1] < 0) {
            draw_list.push({
              x, y: y + board.length * spriteSize, z, scale, shape, color
            });
          }
          if (ii === board.length-1 && drag_offs[1] > 0) {
            draw_list.push({
              x, y: y - board.length * spriteSize, z, scale, shape, color
            });
          }
        } else if (shift && getshapeWrapped(jj - shift[0], ii - shift[1]) === drag_type) {
          // we will be shifted
          let d = 1;
          while (getshapeWrapped(jj - d * shift[0], ii - d * shift[1]) === drag_type) {
            ++d;
          }
          --d;
          x -= d * shift[0] * spriteSize;
          y -= d * shift[1] * spriteSize;
          if (x < margin_left) {
            x += row.length * spriteSize;
          }
          if (x >= margin_left + row.length * spriteSize) {
            x -= row.length * spriteSize;
          }
          if (y < margin_top) {
            y += board.length * spriteSize;
          }
          if (y >= margin_top + board.length * spriteSize) {
            y -= board.length * spriteSize;
          }
        }
        draw_list.push({
          x, y, z, scale, shape, color
        });
      }
    }
    draw_list.sort(cmpDrawList);
    for (let ii = 0; ii < draw_list.length; ++ii) {
      let elem = draw_list[ii];
      let sprite = piece_sprites[elem.shape];
      sprite.x = elem.x;
      sprite.y = elem.y;
      sprite.setScale([elem.scale, elem.scale]);
      sprite.setColor(elem.color);
      draw2D.drawSprite(sprite);
    }
    // draw border
    draw2D.drawSprite(border_sprite);
    // draw faders
    let dfade = dt / 800;
    for (let ii = faders.length - 1; ii >= 0; --ii) {
      if (dfade >= faders[ii].t) {
        faders.splice(ii, 1);
      } else {
        faders[ii].t -= dfade;
        let sprite = piece_sprites[faders[ii].value];
        sprite.x = margin_left + spriteSize * faders[ii].x;
        sprite.y = margin_top + spriteSize * faders[ii].y;
        sprite.setColor([faders[ii].color[0], faders[ii].color[1], faders[ii].color[2], Math.min(1, faders[ii].t * 2)]);
        let scale = 2 - faders[ii].t;
        sprite.setScale([scale, scale]);
        draw2D.drawSprite(sprite);
      }
    }
  }

  game_state = titleInit;

  var last_tick = Date.now();
  function tick() {
    if (!graphicsDevice.beginFrame()) {
      return;
    }
    var now = Date.now();
    var dt = Math.min(Math.max(now - last_tick, 1), 250);
    last_tick = now;
    global_timer += dt;
    input.tick();

    {
      let screen_width = graphicsDevice.width;
      let screen_height = graphicsDevice.height;
      let screen_aspect = screen_width / screen_height;
      let view_aspect = game_width / game_height;
      if (screen_aspect > view_aspect) {
        let viewport_width = game_height * screen_aspect;
        let half_diff = (viewport_width - game_width) / 2;
        configureParams.viewportRectangle = [-half_diff, 0, game_width + half_diff, game_height];
      } else {
        let viewport_height = game_width / screen_aspect;
        let half_diff = (viewport_height - game_height) / 2;
        configureParams.viewportRectangle = [0, -half_diff, game_width, game_height + half_diff];
      }
      draw2D.configure(configureParams);
    }

    if (window.need_repos) {
      --window.need_repos;
      var ul = draw2D.viewportUnmap(0, 0);
      var lr = draw2D.viewportUnmap(game_width-1, game_height-1);
      var viewport = [ul[0], ul[1], lr[0], lr[1]];
      var height = viewport[3] - viewport[1];
      // default font size of 16 when at height of game_height
      var font_size = Math.min(256, Math.max(2, Math.floor(height/800 * 16)));
      $('#gamescreen').css({
        left: viewport[0],
        top: viewport[1],
        width: viewport[2] - viewport[0],
        height: height,
        'font-size': font_size,
      });
      $('#fullscreen').css({
        'font-size': font_size,
      });
    }

    draw2D.setBackBuffer();
    draw2D.clear([0, 0, 0, 1]);

    draw2D.begin('alpha', 'deferred');

    game_state(dt);

    draw2D.end();
    graphicsDevice.endFrame();
  }

  intervalID = TurbulenzEngine.setInterval(tick, 1000/60);
};
