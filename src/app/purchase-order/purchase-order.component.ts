import { MatTableDataSource } from '@angular/material/table';
import { FormArray, FormBuilder } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs/operators';

import { Product } from '../_model/product';
import { Observable } from 'rxjs';
import { ProductService } from '../_services/product.service';
import { PurchaseOrder } from '../_model/purchaseOrder';
import { PurchaseOrderService } from '../_services/purchase-order.service';
import { Supplier } from '../_model/supplier';
import { SupplierService } from '../_services/supplier.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-purchase-order',
  templateUrl: './purchase-order.component.html',
  styleUrls: ['./purchase-order.component.css']
})
export class PurchaseOrderComponent implements OnInit {
  purchaseOrderDetailData: any;
  displayedColumns: string[] = ['sno', 'action', 'item', 'price', 'quantity', 'totalAmount'];
  filteredSuppliers: Observable<Supplier[]>;
  filteredProducts: Observable<Product[]>;

  suppliers: Supplier[];
  products: Product[];

  previousBalance = 0;
  totalQty = 0;
  totalAmount = 0;

  purchaserOrderForm: FormGroup;
  singleClickDisable = false;

  constructor(
    private _fb: FormBuilder,
    private productService: ProductService,
    private supplierService: SupplierService,
    private purchaseOrderService: PurchaseOrderService, private route: Router) {

    this.suppliers = [];
    this.products = [];
  }

  ngOnInit() {
    this.singleClickDisable = false;
    this.fetchData();
    this._createForm();
    console.log('this.purchaserOrderForm', this.purchaserOrderForm);
  }

  removeProduct(index: number) {
      this.purchaseOrderDetailArr.removeAt(index);
      this.purchaseOrderDetailData = new MatTableDataSource(this.purchaseOrderDetailArr.controls);
  }

  selectedProduct(selectedProduct: string) {
    this.purchaserOrderForm.controls['productName'].setValue(null);
    const product = this._findProduct(selectedProduct);
    this._addProduct(product);
  }

  selectedSupplier(selectedSupplier: string) {
    const supplier = this._findSupplier(selectedSupplier);
    this._supplierBalanceData(supplier?.id);
  }

  fetchData() {
    this.supplierService.getSupplierList().subscribe(data => {
      data.forEach(x => {
        if (x.supplierName != '' && !x.supplierName.startsWith('UNKNOWN')) {
          this.suppliers.push(x);
        }
      });
    });

    this.productService.getProductsList().subscribe(data => {
      this.products = data;
      this._valueChangesListner();
    });
  }

  getCurrentBalance() {
    return this.totalAmount - this.amountPaid.value;
  }

  getTotalBalance() {
    return this.previousBalance + this.getCurrentBalance();
  }

  showMsg: boolean = false;
  
  save(isPrintReq: boolean) {
    this.singleClickDisable = true;
    if (this.purchaseOrderDetailArr.value.length === 0) {
      alert('please select products, before submitting');
      this.singleClickDisable = false;
      return;
    }
    const supplierName = this.purchaserOrderForm.get('supplierName').value;
    let supplier = this._findSupplier(supplierName);
    
    const purchaseOrder: PurchaseOrder = new PurchaseOrder();
    if (supplier === undefined) {
      supplier = this.saveSupplier(supplierName);
    }
    supplier.phoneNumber = this.purchaserOrderForm.get('motorVehicleNo').value;
    purchaseOrder.supplier = supplier;
    purchaseOrder.currentBalance = this.getCurrentBalance();
    purchaseOrder.purchaseOrderDetail = this.purchaseOrderDetailArr.value;
    purchaseOrder.totalPrice = this.totalAmount;
    //purchaseOrder.vehicleNo = this.purchaserOrderForm.get('motorVehicleNo').value;
    purchaseOrder.amountPaid = this.purchaserOrderForm.get('amountPaid').value;
    purchaseOrder.dueDate = this.purchaserOrderForm.get('dueDate').value?.getTime();;
    purchaseOrder.billDate = this.purchaserOrderForm.get('billDate').value?.getTime();;

    if (purchaseOrder.amountPaid < 0) {
      alert('Amount paid should be positive');
      this.singleClickDisable = false;
      return;
    } else if (this.getTotalBalance() < 0) {
      alert('Amount paid should be equals to balance');
      this.singleClickDisable = false;
      return;
    } else if (this.getTotalBalance() <= 0) {
      purchaseOrder.status = 'PAID';
    } else if (purchaseOrder.amountPaid > 0) {
      purchaseOrder.status = 'PARTIAL';
    } else {
      purchaseOrder.status = 'DUE';
    }

    if (confirm("Are you sure to save?")) {
      this.purchaseOrderService
        .createPurchaseOrder(purchaseOrder).subscribe(data => {
          console.log(data);
          this.singleClickDisable = false;
          if (isPrintReq) {
            this._printPdf(data);
            window.location.reload();
          } else {
            this.showMsg= true;

              setTimeout(function(){
                //alert('as')
                window.location.reload();
              }, 1500);
              
              //alert('Sales Order Successfully created!!');
          }
        },
          error => {
            console.log(error);
            this.singleClickDisable = false;
          });
    } else {
      this.singleClickDisable = false;
    }
  }

  saveSupplier(supplierName: string): any {
    let data = {
      supplierName: supplierName,
      gstIn: 'NA',
      phoneNumber: 'NA'
    };
    return data;;
  }

  refreshAfterSave() {
    //this.route.navigate(['purchaseOrder'])
    //this.route.navigateByUrl('/dashboard');
    //window.location.reload();
    this.previousBalance = 0;
    this.totalAmount = 0;
    this.purchaseOrderDetailData = [];
    this._createForm();
    this.fetchData();
  }

  private _supplierBalanceData(supplierID: any) {
    this.purchaseOrderService.getPurchaseOrderBalaceBySupplier(supplierID).subscribe((data: number) => {
      this.previousBalance = data;
    }, (error: any) => console.log(error));
  }

  private _printPdf(response) {
    //const url = `${location.origin}/praveen-traders/#table`;
    const url = `${location.origin}/#table`;
    const myWindow = window.open(url);
    myWindow['response'] = response;
  }

  private _filterSupplier(value: string): Supplier[] {
    if (!value) {
      this.previousBalance = 0.00;
      return this.suppliers;
    }
    const filterValue = value.toLowerCase();
    const supplierList = this.suppliers.filter(option => option.supplierName.toLowerCase().includes(filterValue))
    if (supplierList.length == 0) {
      this.previousBalance = 0.00;
    }
    return supplierList;
  }

  private _filterProduct(value: string): Product[] {
    if (!value) {
      return this.products;
    }
    const filterValue = value.toLowerCase();
    return this.products.filter(option => option.productName.toLowerCase().includes(filterValue));
  }

  private _findProduct(value: string): Product {
    return this.products.find(option => option.productName === value);
  }

  private _findSupplier(value: string): Supplier {
    return this.suppliers.find(option => option.supplierName === value);
  }

  private _initRow(product) {
    return this._fb.group({
      price: [, [Validators.required, Validators.min(1), Validators.max(100000)]],
      qtyOrdered: [, [Validators.required, Validators.min(1), Validators.max(10000)]],
      product: [product]
    });
  }

  private _addProduct(product: Product) {
    let isProductAdded = true;
    this.purchaseOrderDetailArr.value.forEach(element => {
      if (product.productName === element.product.productName) {
        alert('Product is already Added!!');
        isProductAdded = false;
      }
    });

    if (isProductAdded) {
      const newRow = this._initRow(product);
      this.purchaseOrderDetailArr.push(newRow);
      this.purchaseOrderDetailData = new MatTableDataSource(this.purchaseOrderDetailArr.controls);
    }
  }

  private _valueChangesListner() {
    this.filteredSuppliers = this.purchaserOrderForm.controls['supplierName'].valueChanges.pipe(
      startWith(''),
      map(value => this._filterSupplier(value))
    );

    this.filteredProducts = this.purchaserOrderForm.controls['productName'].valueChanges.pipe(
      startWith(''),
      map(value => this._filterProduct(value))
    );

    this.purchaseOrderDetailArr.valueChanges.subscribe((productList) => {
      let totalAmount = 0;
      let totalQtyCal = 0;
      productList.forEach(product => {
        const amount = Number(product.qtyOrdered) * Number(product.price);
        //const taxAmount = amount * (product.product?.gst || 0) / 100;
        //totalAmount += amount + taxAmount;
        totalQtyCal += product.qtyOrdered;
        totalAmount += amount;
      });
      this.totalQty = totalQtyCal;
      this.totalAmount = Math.round(totalAmount);
    });
  }

  private _createForm() {
    this.purchaserOrderForm = this._fb.group({
      supplierName: [''],
      productName: [''],
      motorVehicleNo: [''],
      billDate: [new Date()],
      dueDate: [],
      purchaseOrderDetail: this._fb.array([]),
      amountPaid: [],
    });
  }

  get purchaseOrderDetailArr() {
    return this.purchaserOrderForm.get('purchaseOrderDetail') as FormArray;
  }

  get amountPaid() {
    return this.purchaserOrderForm.get('amountPaid') as FormControl;
  }
}
