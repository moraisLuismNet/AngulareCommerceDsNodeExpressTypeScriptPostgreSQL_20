import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  afterNextRender,
  inject,
  DestroyRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  //environment
} from "@angular/core";
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from "@angular/forms";
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

// PrimeNG
import { ConfirmationService, MessageService } from "primeng/api";
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileUploadModule } from 'primeng/fileupload';
import { TooltipModule } from 'primeng/tooltip';

// Services
import { IRecord } from "../EcommerceInterface";
import { RecordsService } from "../services/RecordsService";
import { GroupsService } from "../services/GroupsService";
import { StockService } from "../services/StockService";
import { CartService } from "../services/CartService";
import { UserService } from "src/app/services/UserService";
import { MessageModule } from 'primeng/message';

import { environment } from "src/environments/environment";

@Component({
    selector: "app-records",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        InputNumberModule,
        DialogModule,
        ConfirmDialogModule,
        FileUploadModule,
        TooltipModule,
        MessageModule
    ],
    templateUrl: "./RecordsComponent.html",
    styleUrls: ["./RecordsComponent.css"],
    providers: [ConfirmationService, MessageService]
})
export class RecordsComponent implements OnInit {
  @ViewChild("form") form!: NgForm;
  @ViewChild("fileInput") fileInput!: ElementRef;
  @ViewChild("recordsTable") recordsTable!: ElementRef<HTMLTableElement>;
  visibleError = false;
  errorMessage = "";
  records: IRecord[] = [];
  filteredRecords: IRecord[] = [];
  visibleConfirm = false;
  imageRecord = "";
  visiblePhoto = false;
  photo = "";
  searchText: string = "";

  record: IRecord = {
    IdRecord: 0,
    TitleRecord: "",
    YearOfPublication: null,
    ImageRecord: null,
    Photo: null,
    PhotoName: null,
    Price: 0,
    stock: 0,
    Discontinued: false,
    GroupId: null,
    GroupName: "",
    NameGroup: "",
  };

  // Flag to track if a file has been selected
  fileSelected: boolean = false;

  groups: any[] = [];
  recordService: any;
  private resizeObserver!: ResizeObserver;
  private destroyRef = inject(DestroyRef);
  
  // Services injected using constructor
  constructor(
    private recordsService: RecordsService,
    private groupsService: GroupsService,
    private confirmationService: ConfirmationService,
    private stockService: StockService,
    private cartService: CartService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private messageService: MessageService
  ) {

    // This will run after the next change detection cycle
    afterNextRender(() => {
      this.updateTableVisuals();
    });
  }

  ngOnInit(): void {
    this.getRecords();
    this.getGroups();

    // Subscribe to stock updates
    this.stockService.stockUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ recordId, newStock }) => {
        const record = this.records.find((r) => r.IdRecord === recordId);
        if (record) {
          record.stock = newStock;
          // Update filtered records as well
          const filteredRecord = this.filteredRecords.find(
            (r) => r.IdRecord === recordId
          );
          if (filteredRecord) {
            filteredRecord.stock = newStock;
          }
        }
      });

    // Subscribe to cart updates
    this.cartService.cart$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cartItems) => {
        this.records.forEach((record) => {
          const cartItem = cartItems.find(
            (item) => item.IdRecord === record.IdRecord
          );
          record.inCart = !!cartItem;
          record.Amount = cartItem ? cartItem.Amount || 0 : 0;
        });
        this.filteredRecords = [...this.records];
      });
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private updateTableVisuals(): void {
    // Update any table visual elements
  }

  getRecords() {
    
    this.recordsService.getRecords().subscribe({
      next: (data: any) => {
        
        if (!data) {
          console.error('No data was received from the service');
          this.errorMessage = 'No data was received from the service';
          this.visibleError = true;
          return;
        }
        
        const recordsArray = Array.isArray(data)
          ? data
          : Array.isArray(data?.$values)
          ? data.$values
          : Array.isArray(data?.data)
          ? data.data
          : [];
        
        if (recordsArray.length === 0) {
          console.warn('No records were received from the service');
        }

        // Get the groups to assign names
        this.groupsService.getGroups().subscribe({
          next: (groupsResponse: any) => {
            const groups = Array.isArray(groupsResponse)
              ? groupsResponse
              : Array.isArray(groupsResponse.$values)
              ? groupsResponse.$values
              : [];

            // Assign the group name to each record
            recordsArray.forEach((record: IRecord) => {
              const group = groups.find(
                (g: { idGroup: number | null }) => g.idGroup === record.GroupId
              );
              if (group) {
                record.GroupName = group.nameGroup;
              }
            });

            this.records = recordsArray;
            this.filteredRecords = [...this.records];
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            console.error("Error getting groups:", err);
            this.records = recordsArray;
            this.filteredRecords = [...this.records];
            this.cdr.detectChanges();
          },
        });
      },
      error: (err: any) => {
        console.error("Error getting records:", err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.detectChanges();
      },
    });
  }

  filterRecords() {
    if (!this.searchText?.trim()) {
      this.filteredRecords = [...this.records];
      return;
    }

    const searchTerm = this.searchText.toLowerCase();
    this.filteredRecords = this.records.filter((record) => {
      return (
        record.TitleRecord?.toLowerCase().includes(searchTerm) ||
        record.GroupName?.toLowerCase().includes(searchTerm) ||
        record.YearOfPublication?.toString().includes(searchTerm)
      );
    });
  }

  onSearchChange() {
    this.filterRecords();
  }

  getGroups() {
    this.groupsService.getGroups().subscribe({
      next: (response: any) => {
        // Flexible handling of different response structures
        let groupsArray = [];

        if (Array.isArray(response)) {
          // The answer is a direct array
          groupsArray = response;
        } else if (Array.isArray(response.$values)) {
          // The response has property $values
          groupsArray = response.$values;
        } else if (Array.isArray(response.data)) {
          // The response has data property
          groupsArray = response.data;
        } else {
          console.warn("Unexpected API response structure:", response);
        }

        this.groups = groupsArray;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error("Error loading groups:", err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.detectChanges();
      },
    });
  }

  onChange(event: any) {
    const file = event.target.files;

    if (file && file.length > 0) {
      this.record.Photo = file[0];
      this.record.PhotoName = file[0].name;
      this.fileSelected = true;
    } else {
      this.fileSelected = false;
      this.record.Photo = null;
      this.record.PhotoName = null;
    }
  }

  onAceptar() {
    this.fileInput.nativeElement.value = "";
  }

  showImage(record: IRecord): void {
    // Toggle visibility if clicking the same record's image
    if (this.visiblePhoto && this.record?.IdRecord === record.IdRecord) {
      this.visiblePhoto = false;
      return;
    }

    // Set the current record
    this.record = { ...record };
    
    // Handle the image source safely
    if (record.ImageRecord) {
      const imageUrl = record.ImageRecord.toString();
      
      // If it's a base64 string or a data URL
      if (imageUrl.startsWith('data:image')) {
        this.photo = imageUrl;
      } 
      // If it's just a filename, construct the full URL
      else if (!imageUrl.startsWith('http')) {
        this.photo = `${environment.urlAPI}uploads/${imageUrl}`;
      }
      // If it's already a full URL
      else {
        this.photo = imageUrl;
      }
    } else {
      // Set a default image if no image is available
      this.photo = 'assets/images/no-image-available.png';
      console.warn('No image available for record:', record.TitleRecord);
    }
    
    this.visiblePhoto = true;
  }

  save() {
    
    // Validate required fields
    if (!this.record.TitleRecord || this.record.TitleRecord.trim() === '') {
      this.visibleError = true;
      this.errorMessage = 'Title is required';
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Title is required',
        life: 3000
      });
      return;
    }

    if (this.record.IdRecord === 0) {
      // Add new record
      this.recordsService.addRecord(this.record).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Record added successfully',
            life: 3000
          });
          this.form.reset();
          this.cancelEdition();
          this.getRecords();
        },
        error: (err) => {
          console.error('Error adding record:', err);
          this.visibleError = true;
          
          // Enhanced error handling
          let errorMessage = 'An error occurred while adding the record';
          
          if (err.status === 400) {
            // Handle 400 Bad Request with validation errors
            if (err.error && typeof err.error === 'object') {
              // If the error has specific validation messages
              const errorObj = err.error;
              errorMessage = 'Validation error: ' + Object.values(errorObj).flat().join(' ');
            } else if (err.error && typeof err.error === 'string') {
              errorMessage = err.error;
            }
          } else if (err.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (err.status === 403) {
            errorMessage = 'You do not have permission to perform this action.';
          } else if (err.status === 404) {
            errorMessage = 'The requested resource was not found.';
          } else if (err.status >= 500) {
            errorMessage = 'A server error occurred. Please try again later.';
          }
          
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: errorMessage,
            life: 5000
          });
          
          this.controlError(err);
        },
      });
    } else {
      // Update existing record
      this.recordsService.updateRecord(this.record).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Record updated successfully',
            life: 3000
          });
          this.cancelEdition();
          this.form.reset();
          this.getRecords();
        },
        error: (err) => {
          console.error('Error updating record:', err);
          this.visibleError = true;
          this.controlError(err);
        },
      });
    }
  }

  confirmDelete(record: IRecord) {
    this.confirmationService.confirm({
      message: `Delete record ${record.TitleRecord}?`,
      header: "Are you sure?",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Yes",
      acceptButtonStyleClass: "p-button-danger",
      accept: () => this.deleteRecord(record.IdRecord),
    });
  }

  deleteRecord(id: number) {
    
    this.recordsService.deleteRecord(id).subscribe({
      next: (data: any) => {
        this.visibleError = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Record deleted successfully',
          life: 3000
        });
        this.getRecords();
      },
      error: (err: any) => {
        console.error('Error deleting record:', err);
        this.visibleError = true;
        
        let errorMessage = 'An error occurred while deleting the record';
        
        if (err.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
          // Optionally redirect to login
          // this.router.navigate(['/login']);
        } else if (err.status === 403) {
          errorMessage = 'You do not have permission to delete this record';
        } else if (err.status === 404) {
          errorMessage = 'Record not found or already deleted';
        } else if (err.response) {
          // Handle server response with error details
          if (err.response.message) {
            errorMessage = err.response.message;
          } else if (err.response.error) {
            errorMessage = err.response.error;
          }
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
          life: 5000
        });
        
        this.controlError(err);
        this.cdr.detectChanges();
      },
    });
  }

  edit(record: IRecord) {
    
    // Create a deep copy of the record to avoid modifying the original
    this.record = JSON.parse(JSON.stringify(record));
    
    // Ensure required fields have default values
    this.record.stock = record.stock ?? 1;
    this.record.Price = record.Price ?? 0;
    this.record.Discontinued = record.Discontinued ?? false;
    
    // Handle the photo name
    this.record.PhotoName = record.ImageRecord
      ? this.extractImageName(record.ImageRecord)
      : "";
    
    // Clear any previous file input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.fileSelected = false;
    
    // Set the group information
    if (record.GroupId) {
      const selectedGroup = this.groups.find(
        (g) => g.IdGroup === record.GroupId
      );
      if (selectedGroup) {
        this.record.GroupName = selectedGroup.NameGroup;
      }
    }
    
    // Scroll to form for better UX
    setTimeout(() => {
      const formElement = document.querySelector('form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  extractImageName(url: string): string {
    return url.split("/").pop() || "";
  }

  cancelEdition() {
    this.record = {
      IdRecord: 0,
      TitleRecord: "",
      YearOfPublication: null,
      ImageRecord: null,
      Photo: null,
      PhotoName: null,
      Price: 0,
      stock: 0,
      Discontinued: false,
      GroupId: null,
      GroupName: "",
      NameGroup: "",
    };
  }

  controlError(err: any) {
    if (err.error && typeof err.error === "object" && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === "string") {
      this.errorMessage = err.error;
    } else {
      this.errorMessage = "An unexpected error has occurred";
    }
  }

  addToCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail) return;

    this.cartService.addToCart(record).subscribe(
      (response) => {
        // Update UI locally
        record.inCart = true;
        record.Amount = (record.Amount || 0) + 1;
        this.filteredRecords = [...this.records];
      },
      (error) => {
        console.error("Error adding to cart:", error);
        // Revert local changes if it fails
        record.inCart = false;
        record.Amount = 0;
        this.filteredRecords = [...this.records];
      }
    );
  }

  removeFromCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail || !record.inCart) return;

    this.cartService.removeFromCart(record).subscribe(
      (response) => {
        // Update UI locally
        record.Amount = Math.max(0, (record.Amount || 0) - 1);
        record.inCart = record.Amount > 0;
        this.filteredRecords = [...this.records];
      },
      (error) => {
        console.error("Error removing from cart:", error);
        // Revert local changes if it fails
        record.Amount = (record.Amount || 0) + 1;
        record.inCart = true;
        this.filteredRecords = [...this.records];
      }
    );
  }
}
