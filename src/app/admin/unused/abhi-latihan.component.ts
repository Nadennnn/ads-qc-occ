// ============================================
// FILE: src/app/admin/admin.component.ts
// SECURE VERSION - Compatible dengan struktur API kamu
// ============================================
import { Component, OnInit, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-abhi-latihan',
  templateUrl: './abhi-latihan.component.html',
  styleUrls: ['./abhi-latihan.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class AbhiLatihanComponent implements OnInit {
  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.
  }
}
