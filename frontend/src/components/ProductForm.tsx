import { useForm } from '@tanstack/react-form'
import { useApiMutation } from '../hooks/useApi'

type ProductFormData = {
  name: string
  sku: string
  price: number
  stock: number
  description: string
}

export function ProductForm() {
  const createProduct = useApiMutation<ProductFormData>('/admin/products', 'POST')

  const form = useForm({
    defaultValues: {
      name: '',
      sku: '',
      price: 0,
      stock: 0,
      description: '',
    } as ProductFormData,
    onSubmit: async ({ value }) => {
      try {
        await createProduct.mutateAsync(value)
        alert('Produk berhasil ditambahkan!')
        form.reset()
      } catch (error) {
        alert(`Error: ${(error as Error).message}`)
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-4 max-w-md"
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) =>
            !value ? 'Nama produk wajib diisi' : undefined,
        }}
      >
        {(field) => (
          <div>
            <label htmlFor={field.name} className="block font-medium mb-1">
              Nama Produk
            </label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            />
            {field.state.meta.errors.map((error, i) => (
              <p key={i} className="text-red-500 text-sm mt-1">
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field
        name="sku"
        validators={{
          onChange: ({ value }) =>
            !value ? 'SKU wajib diisi' : undefined,
        }}
      >
        {(field) => (
          <div>
            <label htmlFor={field.name} className="block font-medium mb-1">
              SKU
            </label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            />
            {field.state.meta.errors.map((error, i) => (
              <p key={i} className="text-red-500 text-sm mt-1">
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field
        name="price"
        validators={{
          onChange: ({ value }) =>
            value <= 0 ? 'Harga harus lebih dari 0' : undefined,
        }}
      >
        {(field) => (
          <div>
            <label htmlFor={field.name} className="block font-medium mb-1">
              Harga
            </label>
            <input
              id={field.name}
              name={field.name}
              type="number"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded"
            />
            {field.state.meta.errors.map((error, i) => (
              <p key={i} className="text-red-500 text-sm mt-1">
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field
        name="stock"
        validators={{
          onChange: ({ value }) =>
            value < 0 ? 'Stok tidak boleh negatif' : undefined,
        }}
      >
        {(field) => (
          <div>
            <label htmlFor={field.name} className="block font-medium mb-1">
              Stok
            </label>
            <input
              id={field.name}
              name={field.name}
              type="number"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded"
            />
            {field.state.meta.errors.map((error, i) => (
              <p key={i} className="text-red-500 text-sm mt-1">
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <div>
            <label htmlFor={field.name} className="block font-medium mb-1">
              Deskripsi
            </label>
            <textarea
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              rows={3}
            />
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Menyimpan...' : 'Tambah Produk'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
