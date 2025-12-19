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
// Services
import { LoginBridgeComponent } from './login-bridge.component';
import { LoginBridgeRoutes } from './login-bridge.routing';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [DatePipe],
  declarations: [LoginBridgeComponent],
  imports: [
    RouterModule.forChild(LoginBridgeRoutes),
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
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
export class LoginBridgeModule {}
