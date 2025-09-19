import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './AppComponent.html',
})
export class AppComponent {
  title = 'AngularLibrary';
}
