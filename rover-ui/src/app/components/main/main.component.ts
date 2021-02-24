import { Component, OnDestroy, OnInit } from '@angular/core';
import { fromEvent, interval, Subscription } from 'rxjs';
import { filter, map, throttle } from 'rxjs/operators';
import JSMpeg from '@cycjimmy/jsmpeg-player';

import { WebSocketService } from '../../core/webSocket/web-socket.service'

import { environment } from '../../../environments/environment';

export enum TWO_AXIS_KEY_CODE {
  RIGHT_ARROW = 'ArrowRight',
  LEFT_ARROW = 'ArrowLeft',
  UP_ARROW = 'ArrowUp',
  DOWN_ARROW = 'ArrowDown'
}

const xMinPosition: number = 1930;
const xMaxPosition: number = 2485;

const yMinPosition: number = 1590;
const yMaxPosition: number = 750;

const streamUrl:string = environment.streamEndpoint;

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit, OnDestroy {

  keyPressed: any
  websocket: WebSocketService;
  messages$: Subscription;

  xMinMaxPosition: boolean = false;
  yMinMaxPosition: boolean = false;

  private keydownFromEvent = fromEvent(window, 'keydown');
  private keydownObservable = this.keydownFromEvent.pipe(
    filter((event: KeyboardEvent) => this.keyFilter(event)),
    map((event: KeyboardEvent) => event.code),
    throttle(() => interval(50))
  );
  private keydownSubscription: Subscription;

  keyFilter(event: KeyboardEvent) {
    const keyCodes: string[] = Object.values(TWO_AXIS_KEY_CODE);
    const code: string = event.code;
    if (keyCodes.includes(code)) {
      return true;
    }
    return false;
  }

  keyDownEventProcessor(code: string) {
    this.websocket.sendMessage(code)
  }

  constructor(websocket: WebSocketService) {
    this.websocket = websocket;
  }

  ngOnDestroy(): void {
    this.keydownSubscription.unsubscribe()
  }

  ngOnInit() {
    this.messages$ = this.websocket.connect().subscribe((webMessage: any) => {
      this.keyPressed = webMessage;
      this.maxPosition(webMessage['y'], webMessage['x'])
    })
    this.keydownSubscription = this.keydownObservable.subscribe((code: string) => this.keyDownEventProcessor(code));
    var canvas = document.getElementById('video-canvas');
    var player = new JSMpeg.Player(streamUrl, { canvas: canvas });
  }

  maxPosition(yCurrentPosition: number, xCurrentPosition: number) {
    if (yCurrentPosition === yMinPosition || yCurrentPosition === yMaxPosition) {
      this.yMinMaxPosition = true;
    } else {
      this.yMinMaxPosition = false;
    }

    if (xCurrentPosition === xMaxPosition || xCurrentPosition === xMinPosition) {
      this.xMinMaxPosition = true;
    } else {
      this.xMinMaxPosition = false;
    }
  }

}

