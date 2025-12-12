import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TimbanganData, TimbanganService } from '../../services/timbangan.service';

@Component({
  selector: 'app-print-slip',
  templateUrl: './print-slip.component.html',
  styleUrls: ['./print-slip.component.scss'],
  standalone: false,
})
export class PrintSlipComponent implements OnInit {
  data: TimbanganData | null = null;
  notFound = false;
  currentDateTime = new Date().toISOString();

  constructor(private route: ActivatedRoute, private timbanganService: TimbanganService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const item = this.timbanganService.getTimbanganDataById(id);
      if (item) {
        this.data = item;
        // Auto print after view loaded
        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        this.notFound = true;
      }
    }
  }

  get beratPotongan(): number {
    if (!this.data || !this.data.beratNetto || !this.data.timbanganKedua) return 0;
    const nettoKotor = this.data.timbanganPertama - this.data.timbanganKedua;
    return nettoKotor - this.data.beratNetto;
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  print(): void {
    window.print();
  }

  close(): void {
    window.close();
  }
}
