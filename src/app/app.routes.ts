import { Routes } from '@angular/router';
import { Step1CropComponent } from './components/step1-crop/step1-crop.component';
import { Step2BwComponent } from './components/step2-bw/step2-bw.component';
import { Step3StlComponent } from './components/step3-stl/step3-stl.component';

export const routes: Routes = [
  { path: '', redirectTo: 'step1', pathMatch: 'full' },
  { path: 'step1', component: Step1CropComponent },
  { path: 'step2', component: Step2BwComponent },
  { path: 'step3', component: Step3StlComponent },
];
