import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'lucide-icons',
  template: `<lucide-angular
    name="{{ iconsName }}"
    [size]="size"
    color="{{ color }}"
    [strokeWidth]="strokewidth"
    class="my-icon"
  ></lucide-angular>`,
  standalone: false,
})
export class LucideIconsComponent {
  /**
   * Constructor
   */

  constructor(private router: Router) {}

  // Cara Penggunaan:
  // Ketik lucide-icons lalu di tab
  // <lucide-icons [iconsName]="'menu'" />

  // Kemudian di bagian admin.module tambahkan import sesuai icon yang digunakan
  // pada bagian ini :
  //import {
  //     LucideAngularModule,
  //     File,
  //     House,
  //     Menu,
  //     UserCheck,
  //     CalendarFold,
  // } from 'lucide-angular';

  // dan ini juga :
  //  LucideAngularModule.pick({
  //             File,
  //             House,
  //             Menu,
  //             UserCheck,
  //             CalendarFold,
  //         }),

  // misal digunakan didalam button untuk ganti warna nya bisa pakai seperti ini:
  // <button class="text-blue-500">
  //     <lucide-icons [iconsName]="'menu'" />
  // </button> ------- atau bisa gunainnya seperti ini:
  //  <lucide-icons
  //     [iconsName]="'user_check'"
  //     [size]="'24'"
  //     [color]="'blue'"
  //     [strokewidth]="'1'"
  // />

  // UNTUK SEKARANG YANG SUDAH ADA
  // <lucide-angular name="file" class="my-icon"></lucide-angular>
  // <lucide-icon name="house" class="my-icon"></lucide-icon>
  // <i-lucide name="menu" class="my-icon"></i-lucide>
  // <span-lucide name="user-check" class="my-icon"></span-lucide>

  // List icons bisa dilihat di: https://lucide.dev/icons/

  @Input() iconsName: string = 'user-check';
  @Input() size: number = 24;
  @Input() color: string = 'currentColor';
  @Input() strokewidth: number = 1;
}
