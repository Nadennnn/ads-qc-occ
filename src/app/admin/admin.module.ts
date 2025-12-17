import { CommonModule, DatePipe } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  AArrowDown,
  AArrowUp,
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  ContactRound,
  Eye,
  Hourglass,
  Info,
  Lock,
  LucideAngularModule,
  Power,
  Printer,
  PrinterCheck,
  RefreshCw,
  Scale,
  Sheet,
  SquarePlus,
  UserCheck,
  UserCog,
  UserRound,
  UsersRound,
  X,
} from 'lucide-angular';
import { AdminComponent } from './admin.component';
import { AdminRoutes } from './admin.routing';
import { PrintSlipComponent } from './components/print-slip/print-slip.component';
import { CekLaporanComponent } from './pages/cek-laporan/cek-laporan.component';
import { LoginComponent } from './pages/login/login.component';
import { TimbanganMasukComponent } from './pages/timbangan-masuk/timbangan-masuk.component';
import { UjiKelembapanComponent } from './pages/uji-kelembapan/uji-kelembapan.component';
// Services
import { CustomerDropdownComponent } from './components/customer-dropdown/customer-dropdown.component';
import { LucideIconsComponent } from './components/utils/lucide-icons.component';
import { ClickOutsideDirective } from './directives/click-outside.directive';
import { GudangBahanBakuComponent } from './gudang-bahan-baku/gudang-bahan-baku.component';
import { CodeCustomerComponent } from './pages/code-customer/code-customer.component';
import { CodeSupplierComponent } from './pages/code-supplier/code-supplier.component';
import { ScaleDisplayComponent } from './pages/scale-display/scale-display.component';
import { UsersControlComponent } from './pages/users-control/users-control.component';
import { TimbanganService } from './services/timbangan.service';
import { AbhiLatihanComponent } from './unused/abhi-latihan.component';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [DatePipe, TimbanganService],
  declarations: [
    AdminComponent,
    UjiKelembapanComponent,
    LoginComponent,
    TimbanganMasukComponent,
    CekLaporanComponent,
    PrintSlipComponent,
    LucideIconsComponent,
    CodeCustomerComponent,
    CodeSupplierComponent,
    CustomerDropdownComponent,
    GudangBahanBakuComponent,
    UsersControlComponent,
    ScaleDisplayComponent,
    AbhiLatihanComponent,
  ],
  imports: [
    RouterModule.forChild(AdminRoutes),
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    ClickOutsideDirective,
    LucideAngularModule.pick({
      AArrowUp,
      AArrowDown,
      UserCheck,
      Sheet,
      PrinterCheck,
      ArrowLeftRight,
      CircleCheckBig,
      Hourglass,
      Scale,
      Power,
      ContactRound,
      UsersRound,
      X,
      UserRound,
      AlertTriangle,
      Check,
      Lock,
      Eye,
      Info,
      UserCog,
      SquarePlus,
      Printer,
      RefreshCw,
      ChevronDown,
      ChevronUp,
    }),
  ],
})
export class AdminModule {}
