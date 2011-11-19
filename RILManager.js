/* -*- tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Telephony.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Kyle Machulis <kyle@nonpolynomial.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

// TODO: Make this more like parcel (i.e. prototyped, etc...)

function RILManager() {
  var send_func = null;

  return {
    token_gen: 1,
    outstanding_messages: {},
    callbacks: [],
    parcel_queue: [],
    receive_state: 0,
    current_size: 0,
    current_length: 0,
    current_data: null,
    receive_sm: null,
    pushBackData: function(data) {
      var new_data = ArrayBuffer(this.current_data.byteLength + data.byteLength);
      Uint8Array(new_data, 0, this.current_data.byteLength).set(Uint8Array(this.current_data));
      Uint8Array(new_data, this.current_data.byteLength, data.byteLength).set(Uint8Array(data));
      this.current_data = new_data;
    },
    popFrontData: function(l) {
      var new_data = ArrayBuffer(this.current_data.byteLength - l);
      Uint8Array(new_data).set(Uint8Array(this.current_data, l, this.current_data.byteLength-l));
      this.current_data = new_data;
    },
    rsm: function() {
      this.current_data = ArrayBuffer();
      while(1) {
        while(this.current_data.byteLength < 4)
        {
          let data = yield;
          this.pushBackData(data);
        }
        this.current_length = (new DataView(this.current_data, 0, 4)).getUint32(0, false);
        this.popFrontData(4);
        while(this.current_data.byteLength < this.current_length)
        {
          let data = yield;
          this.pushBackData(data);
        }
        let new_parcel = ArrayBuffer(this.current_length);
        Uint8Array(new_parcel).set(Uint8Array(this.current_data, 0, this.current_length));
        this.parcel_queue.push(new RILParcel(new_parcel));
        this.popFrontData(this.current_length);
      }
    },
    receive: function(data) {
      if(this.receive_sm == null)
      {
        this.receive_sm = this.rsm();
        this.receive_sm.next();
      }
      this.receive_sm.send(data);
    },
    send : function (request_type, data) {
      let p = new RILParcel();
      p.setRequestType(request_type);
      p.token = this.token_gen++;
      p.data = data;
      p.pack();
      let buff_length = p.buffer.byteLength;
      let buff = ArrayBuffer(12 + buff_length);
      let parcel_length = Uint32Array(buff, 0, 3);
      parcel_length[0] = 8 + buff_length;
      parcel_length.set([(new DataView(buff, 0, 4)).getUint32(0, false), p.request_type, p.token]);
      if(buff_length > 0) {
        Uint8Array(buff, 12, buff_length).set(Uint8Array(p.buffer));
      }
      console.print([x for each (x in Uint8Array(buff))]);
      this.sendFunc(buff);
      this.outstanding_messages[p.token] = p;
    },
    setSendFunc : function(f) {
      this.sendFunc = f;
    },
    exhaust_queue: function () {
      //TODO: Fix
      /*
      while(this.parcel_queue.length > 0)
      {
        if(p.response_type == 0) {
          // match to our outgoing via token
          if(!(p.token in this.outstanding_messages)) {
            throw "Cannot find outgoing message of token " + p.token;
          }
          // get type of outgoing
          let old = this.outstanding_messages[p.token];
          delete this.outstanding_messages[p.token];
          // run callbacks for outgoing type
          p.setRequestType(old.request_type);
        }
        if(p.unpack != undefined) {
          p.unpack();
        }
        else {
          console.print("No unpack function available for request type " + p.request_type);
        }
        // run this.callbacks for unsolicited
        if(p.request_type in this.callbacks) {
          for each(let f in this.callbacks[p.request_type]){
            f(p.data);
          }
        }
        else {
          console.print("No callbacks for " + p.request_name);
        }
        this.current_length = 0;
      }
       */
    },
    addCallback: function (request_type, f){
      if(!(request_type in this.callbacks))
        this.callbacks[request_type] = [];
      this.callbacks[request_type].push(f);
    }
  };
}
