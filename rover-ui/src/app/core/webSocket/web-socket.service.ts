import { Injectable } from '@angular/core';

import { webSocket } from 'rxjs/webSocket';
import { tap, retryWhen, delay, repeatWhen } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';

import { environment } from '../../../environments/environment';


const WS_ENDPOINT = environment.wsEndpoint;

const subject: Subject<webMessage> = <Subject<webMessage>>webSocket(WS_ENDPOINT);

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {

  constructor() {
  }

  public connect(): Observable<webMessage> {
    return this.webSocketSetup()
  }

  private webSocketSetup(): Observable<webMessage> {
    const messages = subject.pipe(
      retryWhen(errors =>
        errors.pipe(
          delay(2000),
          tap(err => console.warn('websocket connection dropped retrying', err))
        )),
      repeatWhen(complete =>
        complete.pipe(
          delay(1000),
          tap(err => console.warn('websocket complete', err))
        )
      ),
      tap(() => {
      })
    );

    return messages;
  }

  public sendMessage(flowMessage: webMessage): void {
    subject.next(flowMessage);
  }


}
