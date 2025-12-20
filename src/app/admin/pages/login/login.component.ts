// src/app/admin/pages/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false,
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;
  showPassword = false;
  returnUrl = '/dashboards'; // ✅ Fixed: dashboards (dengan s)

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboards'], { replaceUrl: true });
    }

    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboards';

    localStorage.clear();
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.username.trim()) {
      this.errorMessage = 'Username tidak boleh kosong';
      return;
    }

    if (!this.password) {
      this.errorMessage = 'Password tidak boleh kosong';
      return;
    }

    if (this.password.length < 1) {
      this.errorMessage = 'Password minimal 1 karakter';
      return;
    }

    this.isLoading = true;

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Login response:', response);

        // ✅ Fixed: Boolean comparison
        if (response.success) {
          console.log('Redirecting to:', this.returnUrl);
          this.router.navigate([this.returnUrl]);
        } else {
          this.errorMessage = response.message || 'Login gagal';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Gagal melakukan login';
        console.error('Login error:', error);
      },
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onInputChange(): void {
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }
}
