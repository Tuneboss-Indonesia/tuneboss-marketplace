import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useApi } from '../hooks/useApi'
import { useState } from 'react'

type Product = {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  isActive: boolean
}

type ProductsResponse = {
  products: Product[]
}

const columnHelper = createColumnHelper<Product>()

export function ProductsTable() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const { data, isLoading, error } = useApi<ProductsResponse>('/products')

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Nama Produk',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('sku', {
        header: 'SKU',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('price', {
        header: 'Harga',
        cell: (info) =>
          new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
          }).format(info.getValue()),
      }),
      columnHelper.accessor('stock', {
        header: 'Stok',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: (info) => (info.getValue() ? 'Aktif' : 'Nonaktif'),
      }),
    ],
    []
  )

  const table = useReactTable({
    data: data?.products || [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (isLoading) {
    return <div className="p-4 text-center">Memuat produk...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {(error as Error).message}</div>
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={globalFilter ?? ''}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Cari produk..."
        className="w-full p-2 border border-gray-300 rounded"
      />

      <table className="w-full border-collapse border border-gray-300">
        <thead className="bg-gray-100">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{
                    asc: ' 🔼',
                    desc: ' 🔽',
                  }[header.column.getIsSorted() as string] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="border border-gray-300 p-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-sm text-gray-600">
        Total: {table.getRowModel().rows.length} produk
      </div>
    </div>
  )
}
