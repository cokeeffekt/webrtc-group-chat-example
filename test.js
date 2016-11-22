var peerTap = function(socket, ice) {

  var ICE_SERVERS = ice || [{
    url: 'stun:stun.l.google.com:19302'
  }];

  this.peers = {};
  this.events = {};
  socket.on('addPeer', (config) => {
    if (config.peer_id in this.peers)
      return; // peer is already in peer list;

    var peer_connection = new webkitRTCPeerConnection({
      iceServers: ICE_SERVERS
    }, {
      optional: [{
        DtlsSrtpKeyAgreement: true
      }]
    });

    peer_connection.dataChannel = peer_connection.createDataChannel('peertaprtcbus');

    peer_connection.emit = function(channel, data) {
      var flattened = JSON.stringify([channel, data]);
      peer_connection.dataChannel.send(flattened);
    };

    this.peers[config.peer_id] = peer_connection;

    peer_connection.onicecandidate = function(event) {
      if (event.candidate) {
        socket.emit('relayICECandidate', {
          'peer_id': config.peer_id,
          'ice_candidate': {
            'sdpMLineIndex': event.candidate.sdpMLineIndex,
            'candidate': event.candidate.candidate
          }
        });
      }
    };

    peer_connection.ondatachannel = event => {
      var receiveChannel = event.channel;
      receiveChannel.onmessage = event => {
        console.log(event);
        logme('DC MESSAGE FROM [' + config.peer_id + ']: ' + event.data);
      };
      receiveChannel.onopen = event => {
        this.triggerEvent('peer-connected', peer_connection);
        logme('DC OPENED [' + config.peer_id + ']');
      };
      receiveChannel.onclose = event => {
        logme('DC CLOSED [' + config.peer_id + ']');
      };
    };
    if (config.should_create_offer) {
      console.log('Creating RTC offer to ', config.peer_id);
      peer_connection.createOffer(
        function(local_description) {
          peer_connection.setLocalDescription(local_description, () => {
            socket.emit('relaySessionDescription', {
              'peer_id': config.peer_id,
              'session_description': local_description
            });
          }, (error) => {});
        }, (error) => {});
    }
  });
  socket.on('sessionDescription', (config) => {
    //      logme('Remote description received: ', config);
    var peer = this.peers[config.peer_id];
    var remote_description = config.session_description;

    var desc = new RTCSessionDescription(remote_description);
    var stuff = peer.setRemoteDescription(desc,
      function() {
        if (remote_description.type == 'offer') {
          peer.createAnswer(local_description => {
            peer.setLocalDescription(local_description, () => {
              signaling_socket.emit('relaySessionDescription', {
                'peer_id': config.peer_id,
                'session_description': local_description
              });
            }, (error) => {});
          }, (error) => {});
        }
      }, (error) => {}
    );
  });

  socket.on('iceCandidate', config => {
    var peer = this.peers[config.peer_id];
    var ice_candidate = config.ice_candidate;
    peer.addIceCandidate(new RTCIceCandidate(ice_candidate));
  });

  socket.on('removePeer', peer_id => {
    if (peer_id in this.peers) {
      this.peers[peer_id].close();
    }
    delete this.peers[peer_id];
  });
};

peerTap.prototype.triggerEvent = function(event, dataArray) {
  Object.keys(this.events).forEach(eKey => {
    if (eKey.split('.')[0] == event)
      this.events[event].forEach(func => {
        func(...dataArray);
      });
  });
};
peerTap.prototype.list = function() {
  console.log(this.peers);
};

peerTap.prototype.broadcast = function(channel, data) {
  Object.values(this.peers).forEach(peer => {
    peer.emit(channel, data);
  });
};

peerTap.prototype.on = function(event, func) {
  if (event in this.events)
    return this.events[event].push(func);
  this.event[event] = [func];
};


var signaling_socket = null; /* our socket.io connection to our webserver */
var peerTapIo = null;

$log = $('.log').css('background-color', 'blue');

function logme(text, obj) {
  var extra = '';
  if (obj) {
    extra = '\n' + JSON.stringify(obj, null, 2);
  }
  $log.append('<div> > ' + text + extra + '</div>');
  $log.scrollTop($log[0].scrollHeight);
}

function init() {
  logme("Connecting to signaling server");
  signaling_socket = io.connect();

  signaling_socket.on('connect', function() {
    logme('Connected to signaling server');
    $log.css('background-color', '#eaffed');
  });

  signaling_socket.on('disconnect', function() {
    $log.css('background-color', 'blue');
  });

  peerTapIo = new peerTap(signaling_socket);

}


$('#b_a').on('click', function() {
  peerTapIo.list();
});
$('#b_b').on('click', function() {
  peerTapIo.broadcast('testing', ['duviuvw', 13]);
});
$('#b_c').on('click', function() {
  console.log('button.click');
});
$('#b_d').on('click', function() {
  console.log('button.click');
});
$('#b_e').on('click', function() {
  console.log('button.click');
});
