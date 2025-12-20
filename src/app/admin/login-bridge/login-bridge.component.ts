import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-bridge',
  templateUrl: './login-bridge.component.html',
  styleUrls: ['./login-bridge.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class LoginBridgeComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.

    const isUserAlreadyLoggedIn = localStorage.getItem('token');

    if (!isUserAlreadyLoggedIn) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/dashboards'], { replaceUrl: true });
    }
  }
}
